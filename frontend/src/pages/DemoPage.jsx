import React, { useState, useEffect, useMemo } from 'react';
import Map from '../components/Map';
import './Page.css';
import './DemoPage.css';

/* ===========================================================================
 * Stage derivation
 *
 * From a single /api/auth/access response we infer the status of every stage
 * in the pipeline. The backend doesn't return a per-stage breakdown, so we
 * reason backwards from the HTTP code + message.
 * =========================================================================*/

const STAGE_PASS = 'pass';
const STAGE_FAIL = 'fail';
const STAGE_SKIP = 'skip';
const STAGE_PEND = 'pending';

const STAGE_DEFS = [
  {
    id: 'validation',
    label: 'Input Validation',
    detail: 'Check username/password length and that lat/lng are real numbers.',
  },
  {
    id: 'credentials',
    label: 'Credentials',
    detail: 'bcrypt-compare the password. Account lockout kicks in after 5 fails / 15 min.',
  },
  {
    id: 'mfa',
    label: 'MFA',
    detail: 'TOTP code (RFC 6238). Skipped if the user has not enrolled.',
  },
  {
    id: 'spoof',
    label: 'IP Spoof Check',
    detail: 'Cross-references ip-api.com + ipinfo.io vs OSM reverse-geocoded country. Detects VPN/proxy.',
  },
  {
    id: 'zone',
    label: 'Zone Match',
    detail: 'Submitted GPS point checked against assigned zones (3m grid first, then circular).',
  },
  {
    id: 'token',
    label: 'Token Issued',
    detail: 'JWT (15 min) + rotated refresh-token cookie set on success.',
  },
];

/**
 * Map a finished /access response to a per-stage status.
 * `pendingStage` lets us animate a "this is the stage we're stuck at" state.
 */
function deriveStages(result, totpSubmitted) {
  if (!result) {
    return STAGE_DEFS.map((s) => ({ ...s, status: STAGE_PEND }));
  }
  const { status, data } = result;
  const msg = data?.msg || data?.message || '';

  // Default everything to skipped, then walk forward filling in.
  const out = STAGE_DEFS.map((s) => ({ ...s, status: STAGE_SKIP }));

  // 400 = validation failure. Nothing else got to run.
  if (status === 400) {
    out[0].status = STAGE_FAIL;
    return out;
  }
  out[0].status = STAGE_PASS;

  // 401 with no MFA hint → bad credentials.
  if (status === 401 && data?.mfa !== 'required' && !msg.includes('TOTP')) {
    out[1].status = STAGE_FAIL;
    return out;
  }
  out[1].status = STAGE_PASS;

  // 401 with mfa=required, OR a TOTP-related error message.
  if (status === 401 && (data?.mfa === 'required' || msg.includes('TOTP'))) {
    out[2].status = totpSubmitted ? STAGE_FAIL : STAGE_PEND;
    return out;
  }

  // If we got past the credentials gate and the user actually sent a TOTP,
  // we can colour it green. Otherwise it was simply skipped (no MFA enrolled).
  out[2].status = totpSubmitted ? STAGE_PASS : STAGE_SKIP;

  // 403 messages tell us which downstream check failed.
  if (status === 403) {
    if (msg.includes('VPN') || msg.includes('country') || msg.includes('too far') || msg.includes('spoof')) {
      out[3].status = STAGE_FAIL;
      return out;
    }
    out[3].status = STAGE_PASS;

    if (msg.includes('not in an authorized')) {
      out[4].status = STAGE_FAIL;
      return out;
    }
  }

  // 200 path
  if (status === 200) {
    // Admin bypass keeps spoof + zone as "skipped" because the backend doesn't run them.
    if (data?.message?.includes('Admin')) {
      out[3].status = STAGE_SKIP;
      out[4].status = STAGE_SKIP;
    } else {
      out[3].status = STAGE_PASS;
      out[4].status = STAGE_PASS;
    }
    out[5].status = STAGE_PASS;
    return out;
  }

  // 500 / unknown — leave the rest as skipped, mark the next-up stage as fail.
  for (const s of out) {
    if (s.status === STAGE_SKIP) { s.status = STAGE_FAIL; break; }
  }
  return out;
}

/* ===========================================================================
 * Scenario classifier (kept from the previous demo for the detail panel)
 * =========================================================================*/

function classifyResult(status, data) {
  if (status === 0) return 'network_error';
  if (status === 400 && data?.errors) return 'validation_error';
  if (status === 400) return 'bad_request';
  if (status === 401 && (data?.mfa === 'required' || data?.msg?.includes('TOTP code required'))) return 'mfa_required';
  if (status === 401 && data?.msg?.includes('Invalid TOTP')) return 'mfa_failed';
  if (status === 401) return 'invalid_credentials';
  if (status === 403 && data?.msg?.includes('VPN or proxy')) return 'spoofed_proxy';
  if (status === 403 && data?.msg?.includes('network country')) return 'spoofed_country';
  if (status === 403 && data?.msg?.includes('too far')) return 'spoofed_distance';
  if (status === 403 && data?.msg?.includes('spoof')) return 'spoofed_generic';
  if (status === 403 && data?.msg?.includes('not in an authorized')) return 'outside_zone';
  if (status === 200 && data?.message?.includes('Admin')) return 'admin_granted';
  if (status === 200 && data?.access === 'granted') return 'granted';
  if (status === 500) return 'server_error';
  return 'unknown';
}

const SCENARIOS = {
  network_error:       { tone: 'warn',  title: 'Network Error',                     blurb: 'The request never reached the server. Likely network/CORS issue.' },
  validation_error:    { tone: 'warn',  title: 'Validation Failed',                 blurb: 'Input was rejected before any auth checks ran.' },
  bad_request:         { tone: 'warn',  title: 'Bad Request',                       blurb: 'The server rejected the request shape.' },
  invalid_credentials: { tone: 'fail',  title: 'Invalid Credentials',               blurb: 'Stopped at step 2. Location checks were never reached.' },
  mfa_required:        { tone: 'warn',  title: 'MFA Required',                      blurb: 'Credentials are valid; the user has TOTP enrolled. Submit a 6-digit code to continue.' },
  mfa_failed:          { tone: 'fail',  title: 'MFA Failed',                        blurb: 'Credentials were valid but the TOTP code was wrong or expired.' },
  spoofed_proxy:       { tone: 'fail',  title: 'Spoof Detected — VPN / Proxy',      blurb: 'The IP was flagged as VPN/proxy/hosting. Blocked at step 4.' },
  spoofed_country:     { tone: 'fail',  title: 'Spoof Detected — Country Mismatch', blurb: 'IP-derived country ≠ GPS-derived country. Blocked at step 4.' },
  spoofed_distance:    { tone: 'fail',  title: 'Spoof Detected — Distance',         blurb: 'IP location too far from claimed GPS. Distance fallback triggered.' },
  spoofed_generic:     { tone: 'fail',  title: 'Spoof Detected',                    blurb: 'IP/GPS analysis flagged the attempt.' },
  outside_zone:        { tone: 'fail',  title: 'Outside Authorized Zone',           blurb: 'Past credentials and spoof check, but the GPS point matched no zone.' },
  admin_granted:       { tone: 'pass',  title: 'Granted — Admin Bypass',            blurb: 'Admin role skips spoof + zone checks. Token issued on credentials alone.' },
  granted:             { tone: 'pass',  title: 'Granted',                           blurb: 'All five checks passed. JWT + refresh cookie issued.' },
  server_error:        { tone: 'fail',  title: 'Server Error',                      blurb: 'Internal error during processing. Check server logs.' },
  unknown:             { tone: 'warn',  title: 'Unknown Response',                  blurb: 'The server returned a response we did not expect.' },
};

/* ===========================================================================
 * Pipeline visualisation
 * =========================================================================*/

function StatusGlyph({ status }) {
  if (status === STAGE_PASS) return '✓';
  if (status === STAGE_FAIL) return '✕';
  if (status === STAGE_SKIP) return '–';
  return '…';
}

function Pipeline({ stages, running }) {
  return (
    <ol className={`pipeline ${running ? 'pipeline--running' : ''}`}>
      {stages.map((s, i) => (
        <li key={s.id} className={`stage stage--${s.status}`} style={{ animationDelay: `${i * 80}ms` }}>
          <div className="stage-bubble" title={s.detail}>
            <StatusGlyph status={s.status} />
          </div>
          <div className="stage-label">{s.label}</div>
        </li>
      ))}
    </ol>
  );
}

/* ===========================================================================
 * Preset scenarios — quickly fill the form to demonstrate a flow
 * =========================================================================*/

const PRESETS = [
  { id: 'inside',    label: 'In-zone (granted)',          help: 'Click a real zone on the map first, then run.' },
  { id: 'outside',   label: 'Outside zone',               coords: { lat: 0, lng: 0 } },
  { id: 'tokyo',     label: 'Country mismatch',           coords: { lat: 35.6762, lng: 139.6503 } },
  { id: 'invalid',   label: 'Wrong password',             user: { username: 'doesnotexist_demo', password: 'WrongPass123!' } },
  { id: 'malformed', label: 'Validation error',           coords: { lat: 999, lng: 0 } },
];

/* ===========================================================================
 * Main component
 * =========================================================================*/

function DemoPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [zones, setZones] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stagesOverride, setStagesOverride] = useState(null); // for animation

  useEffect(() => {
    fetch('/api/zones')
      .then((res) => (res.ok ? res.json() : []))
      .then(setZones)
      .catch(() => setZones([]));
  }, []);

  useEffect(() => {
    if (selectedPosition) {
      setLatitude(selectedPosition.lat.toFixed(6));
      setLongitude(selectedPosition.lng.toFixed(6));
    }
  }, [selectedPosition]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation is not supported by your browser');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setSelectedPosition({ lat, lng });
      },
      () => alert('Unable to retrieve your location')
    );
  };

  const applyPreset = (preset) => {
    if (preset.user) {
      setUsername(preset.user.username);
      setPassword(preset.user.password);
    }
    if (preset.coords) {
      setLatitude(String(preset.coords.lat));
      setLongitude(String(preset.coords.lng));
    }
  };

  const handleTest = async (e) => {
    e?.preventDefault();
    setResult(null);
    setStagesOverride(null);
    setLoading(true);

    // Animate the pending pipeline forward while the request flies.
    const fakeStages = STAGE_DEFS.map((s) => ({ ...s, status: STAGE_PEND }));
    setStagesOverride(fakeStages);

    try {
      const body = {
        username,
        password,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      };
      if (totpCode) body.totpCode = totpCode;

      const response = await fetch('/api/auth/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      setResult({ status: response.status, success: response.ok, data });
    } catch (error) {
      setResult({ status: 0, success: false, data: { msg: 'Network error: ' + error.message } });
    } finally {
      setStagesOverride(null);
      setLoading(false);
    }
  };

  const stages = useMemo(
    () => stagesOverride || deriveStages(result, !!totpCode),
    [stagesOverride, result, totpCode]
  );

  const scenarioKey = result ? classifyResult(result.status, result.data) : null;
  const scenario = scenarioKey ? SCENARIOS[scenarioKey] : null;

  return (
    <div className="demo-layout">
      <main className="demo-main">
        <header className="demo-header">
          <h1>End-to-End Walkthrough</h1>
          <p className="muted">
            One form runs the full pipeline. Watch each stage light up as the response comes back —
            credentials, MFA, IP-spoof check, zone match, token issuance.
          </p>
        </header>

        <Pipeline stages={stages} running={loading} />

        <section className="demo-card">
          <h3>1. Pick a location</h3>
          <p className="muted small">Click the map, type coordinates, or use your current GPS.</p>
          <Map zones={zones} selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} showZoneActions={false} />

          <div className="coord-row">
            <label>Lat
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
            </label>
            <label>Lng
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
            </label>
            <button type="button" onClick={useCurrentLocation}>Use my GPS</button>
          </div>
        </section>

        <section className="demo-card">
          <h3>2. Credentials & MFA</h3>
          <form onSubmit={handleTest} className="creds-grid">
            <label>Username
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label className="mfa-field">
              TOTP <span className="muted small">(optional — only if MFA enrolled)</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <button type="submit" disabled={loading || !latitude || !longitude} className="run-btn">
              {loading ? 'Running…' : 'Run pipeline →'}
            </button>
          </form>

          <div className="presets">
            <span className="muted small">Try a preset:</span>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="preset-chip" onClick={() => applyPreset(p)} title={p.help || ''}>
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {result && scenario && (
          <section className={`demo-card result result--${scenario.tone}`}>
            <h3>{scenario.title}</h3>
            <p className="result-blurb">{scenario.blurb}</p>

            <dl className="result-meta">
              <div><dt>HTTP</dt><dd>{result.status}</dd></div>
              {result.data?.msg && <div><dt>Server msg</dt><dd>{result.data.msg}</dd></div>}
              {result.data?.message && <div><dt>Server msg</dt><dd>{result.data.message}</dd></div>}
              {result.data?.zoneName && <div><dt>Zone</dt><dd>{result.data.zoneName}</dd></div>}
              {result.data?.access && <div><dt>Decision</dt><dd>{result.data.access}</dd></div>}
              {result.data?.token && <div><dt>JWT</dt><dd className="mono trunc">{result.data.token.slice(0, 32)}…</dd></div>}
            </dl>

            {result.data?.errors && (
              <div className="result-errors">
                <strong>Validation errors:</strong>
                <ul>{result.data.errors.map((err, i) => <li key={i}>{err.field}: {err.message}</li>)}</ul>
              </div>
            )}
          </section>
        )}
      </main>

      <aside className="demo-sidebar">
        <div className="sidebar-card">
          <h3>Pipeline reference</h3>
          <ol className="sidebar-stages">
            {STAGE_DEFS.map((s, i) => (
              <li key={s.id}>
                <span className="sidebar-step-n">{i + 1}</span>
                <div>
                  <strong>{s.label}</strong>
                  <p className="muted small">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="muted small">
            Admins skip stages 4–5: a valid credential + MFA grants access regardless of GPS.
          </p>
        </div>

        <div className="sidebar-card">
          <h3>Quick experiments</h3>
          <ul className="sidebar-list">
            <li>Click anywhere on a coloured zone, sign in → <em>granted</em>.</li>
            <li>Click empty ocean → <em>outside zone</em>.</li>
            <li>Run the <em>Country mismatch</em> preset → <em>spoof</em>.</li>
            <li>Sign in as a TOTP-enabled user without a code → <em>MFA required</em>.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

export default DemoPage;
