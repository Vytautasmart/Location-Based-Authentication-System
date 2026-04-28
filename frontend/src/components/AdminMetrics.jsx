import React, { useEffect, useState, useCallback } from 'react';
import './AdminMetrics.css';

const HOUR_OPTIONS = [
  { label: '1h', hours: 1 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
];

function authHeaders() {
  return { 'x-auth-token': localStorage.getItem('token') };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtPct(p) {
  if (p == null) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

function fmtMs(ms) {
  if (ms == null) return '—';
  return `${ms} ms`;
}

function relTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ---------------------------------------------------------------------------
 * KPI tiles
 * ------------------------------------------------------------------------- */
function Kpi({ label, value, sub }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Stacked-bar time series in pure SVG
 * ------------------------------------------------------------------------- */
function TimeSeriesChart({ buckets }) {
  const width = 720;
  const height = 180;
  const padding = { top: 12, right: 12, bottom: 26, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (!buckets || buckets.length === 0) {
    return <div className="empty-state">No attempts in this window.</div>;
  }

  const max = Math.max(1, ...buckets.map((b) => b.granted + b.denied));
  const barW = Math.max(2, innerW / buckets.length - 1);

  return (
    <svg className="ts-chart" width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* y-axis ticks */}
      {[0, 0.5, 1].map((t, i) => {
        const y = padding.top + innerH * (1 - t);
        const v = Math.round(max * t);
        return (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="ts-grid" />
            <text x={padding.left - 6} y={y + 3} textAnchor="end" className="ts-tick">{v}</text>
          </g>
        );
      })}
      {buckets.map((b, i) => {
        const x = padding.left + i * (innerW / buckets.length);
        const grantedH = (b.granted / max) * innerH;
        const deniedH = (b.denied / max) * innerH;
        return (
          <g key={b.bucket}>
            <rect
              x={x}
              y={padding.top + innerH - grantedH}
              width={barW}
              height={grantedH}
              className="ts-bar-granted"
            >
              <title>{`${b.bucket}\n${b.granted} granted, ${b.denied} denied`}</title>
            </rect>
            <rect
              x={x}
              y={padding.top + innerH - grantedH - deniedH}
              width={barW}
              height={deniedH}
              className="ts-bar-denied"
            >
              <title>{`${b.bucket}\n${b.granted} granted, ${b.denied} denied`}</title>
            </rect>
          </g>
        );
      })}
      {/* x-axis labels — first / mid / last bucket */}
      {[0, Math.floor(buckets.length / 2), buckets.length - 1].map((idx) => {
        const b = buckets[idx];
        if (!b) return null;
        const x = padding.left + idx * (innerW / buckets.length);
        return (
          <text key={idx} x={x} y={height - 8} className="ts-tick">
            {new Date(b.bucket).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' })}
          </text>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Horizontal bar list for denial reasons
 * ------------------------------------------------------------------------- */
function DenialReasons({ data }) {
  if (!data) return null;
  const entries = [
    { key: 'bad_credentials', label: 'Bad credentials' },
    { key: 'spoof', label: 'Location spoof / VPN' },
    { key: 'outside_zone', label: 'Outside authorised zone' },
    { key: 'other', label: 'Other' },
  ].map((e) => ({ ...e, value: data[e.key] || 0 }));

  const max = Math.max(1, ...entries.map((e) => e.value));
  const total = entries.reduce((s, e) => s + e.value, 0);

  if (total === 0) return <div className="empty-state">No denials in this window 🎉</div>;

  return (
    <ul className="denial-list">
      {entries.map((e) => (
        <li key={e.key}>
          <div className="denial-row">
            <span className="denial-label">{e.label}</span>
            <span className="denial-value">{e.value}</span>
          </div>
          <div className="denial-bar">
            <div className="denial-bar-fill" style={{ width: `${(e.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
 * User drilldown modal
 * ------------------------------------------------------------------------- */
function UserDrilldown({ userId, onClose, onForceLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchJson(`/api/metrics/users/${userId}`).then(setData).catch(() => setError('Failed to load.'));
  }, [userId]);

  const handleForceLogout = async () => {
    if (!window.confirm(`Revoke every active session for ${data.user.username}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/metrics/users/${userId}/force-logout`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.msg || 'Failed.');
      onForceLogout?.(body);
      const refreshed = await fetchJson(`/api/metrics/users/${userId}`);
      setData(refreshed);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="drilldown-backdrop" onClick={onClose}>
        <div className="drilldown" onClick={(e) => e.stopPropagation()}>
          <p className="error">{error}</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  if (!data) return <div className="drilldown-backdrop"><div className="drilldown">Loading…</div></div>;

  const { user, recent_attempts, zones, sessions } = data;

  return (
    <div className="drilldown-backdrop" onClick={onClose}>
      <div className="drilldown" onClick={(e) => e.stopPropagation()}>
        <div className="drilldown-header">
          <h3>{user.username} <span className="badge">{user.role}</span></h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="drilldown-row">
          <strong>MFA:</strong> {user.totp_enabled ? '✅ enabled' : '⚠️ disabled'}
        </div>

        <div className="drilldown-row">
          <strong>Zones assigned:</strong>{' '}
          {zones.length === 0 ? <em>none (defaults to all zones)</em> : zones.map((z) => z.name).join(', ')}
        </div>

        <div className="drilldown-row">
          <strong>Active sessions:</strong> {sessions.filter((s) => s.active).length} active /{' '}
          {sessions.length} total
          {sessions.filter((s) => s.active).length > 0 && (
            <button className="danger-btn" disabled={busy} onClick={handleForceLogout} style={{ marginLeft: 8 }}>
              Force logout
            </button>
          )}
        </div>

        <h4>Recent attempts</h4>
        <div className="drilldown-table-wrap">
          <table className="metrics-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Outcome</th>
                <th>Spoof</th>
                <th>In zone</th>
                <th>IP</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {recent_attempts.slice(0, 25).map((a) => (
                <tr key={a.id}>
                  <td title={new Date(a.timestamp).toLocaleString()}>{relTime(a.timestamp)}</td>
                  <td className={a.access_granted ? 'ok' : 'fail'}>{a.access_granted ? 'granted' : 'denied'}</td>
                  <td>{a.is_spoofed ? '⚠' : ''}</td>
                  <td>{a.is_location_verified ? '✓' : '—'}</td>
                  <td>{a.ip_address || '—'}</td>
                  <td>{a.latency != null ? `${a.latency} ms` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------- */
export default function AdminMetrics() {
  const [hours, setHours] = useState(24);
  const [summary, setSummary] = useState(null);
  const [series, setSeries] = useState(null);
  const [reasons, setReasons] = useState(null);
  const [recent, setRecent] = useState([]);
  const [users, setUsers] = useState([]);
  const [zoneUsage, setZoneUsage] = useState([]);
  const [drilldownUser, setDrilldownUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, r, recents, u, z] = await Promise.all([
        fetchJson(`/api/metrics/summary?hours=${hours}`),
        fetchJson(`/api/metrics/timeseries?hours=${hours}`),
        fetchJson(`/api/metrics/denial-reasons?hours=${hours}`),
        fetchJson(`/api/metrics/recent?limit=50`),
        fetchJson(`/api/metrics/users?hours=${hours}`),
        fetchJson(`/api/metrics/zones/usage?hours=${hours}`),
      ]);
      setSummary(s);
      setSeries(t);
      setReasons(r);
      setRecent(recents);
      setUsers(u.users);
      setZoneUsage(z.zones);
    } catch {
      setError('Failed to load metrics. (Are you signed in as admin?)');
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh recent feed every 30s
  useEffect(() => {
    const id = setInterval(() => {
      fetchJson(`/api/metrics/recent?limit=50`).then(setRecent).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="metrics-root">
      <div className="metrics-header">
        <h2>Admin Metrics</h2>
        <div className="metrics-controls">
          <div className="window-toggle">
            {HOUR_OPTIONS.map((o) => (
              <button
                key={o.hours}
                className={hours === o.hours ? 'active' : ''}
                onClick={() => setHours(o.hours)}
              >{o.label}</button>
            ))}
          </div>
          <button onClick={load} disabled={loading}>{loading ? 'Loading…' : '↻ Refresh'}</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {summary && (
        <div className="kpi-grid">
          <Kpi label="Attempts" value={fmtNum(summary.attempts)} sub={`${summary.unique_users} unique users`} />
          <Kpi label="Grant rate" value={fmtPct(summary.grant_rate)} sub={`${summary.granted} granted / ${summary.denied} denied`} />
          <Kpi label="Spoofed" value={fmtNum(summary.spoofed)} sub="VPN / country mismatch / distance" />
          <Kpi label="Latency p95" value={fmtMs(summary.latency_ms.p95)} sub={`p50 ${fmtMs(summary.latency_ms.p50)} • avg ${fmtMs(summary.latency_ms.avg)}`} />
          <Kpi label="MFA enabled" value={`${summary.mfa_enabled} / ${summary.users_total}`} sub={fmtPct(summary.mfa_rate)} />
          <Kpi label="Locked accounts" value={fmtNum(summary.currently_locked)} sub="≥5 fails in last 15 min" />
        </div>
      )}

      <div className="metrics-grid">
        <section className="card">
          <h3>Activity over time</h3>
          {series ? <TimeSeriesChart buckets={series.buckets} /> : <p>Loading…</p>}
          <div className="legend">
            <span><span className="dot dot-granted" /> Granted</span>
            <span><span className="dot dot-denied" /> Denied</span>
          </div>
        </section>

        <section className="card">
          <h3>Top denial reasons</h3>
          <DenialReasons data={reasons} />
        </section>

        <section className="card">
          <h3>Zone usage (granted attempts)</h3>
          {zoneUsage.length === 0 ? (
            <div className="empty-state">No zones to report.</div>
          ) : (
            <ul className="zone-usage-list">
              {zoneUsage.map((z) => (
                <li key={z.id}>
                  <span className="zone-name">{z.name}</span>
                  <span className="zone-type-tag">{z.type}</span>
                  <span className="zone-grants">{fmtNum(z.grants)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="footnote">Counts cover circular zones; w3w zones are listed but not counted (point-in-grid match required).</p>
        </section>

        <section className="card">
          <h3>Users</h3>
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>MFA</th>
                  <th>Granted</th>
                  <th>Denied</th>
                  <th>Last seen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>{u.totp_enabled ? '✓' : '—'}</td>
                    <td className="ok">{fmtNum(u.granted)}</td>
                    <td className={u.denied ? 'fail' : ''}>{fmtNum(u.denied)}</td>
                    <td>{relTime(u.last_attempt)}</td>
                    <td><button className="link-btn" onClick={() => setDrilldownUser(u.id)}>View →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card metrics-feed">
          <h3>Live feed <span className="muted">(auto-refresh 30s)</span></h3>
          <div className="metrics-table-wrap">
            <table className="metrics-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                  <th>IP</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id}>
                    <td title={new Date(a.timestamp).toLocaleString()}>{relTime(a.timestamp)}</td>
                    <td>{a.username || <em>unknown</em>}</td>
                    <td className={a.access_granted ? 'ok' : 'fail'}>{a.access_granted ? 'granted' : 'denied'}</td>
                    <td>
                      {a.access_granted ? '—'
                        : !a.user_id ? 'bad credentials'
                        : a.is_spoofed ? 'spoof'
                        : !a.is_location_verified ? 'outside zone'
                        : 'other'}
                    </td>
                    <td>{a.ip_address || '—'}</td>
                    <td>{a.latency != null ? `${a.latency} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {drilldownUser && (
        <UserDrilldown
          userId={drilldownUser}
          onClose={() => setDrilldownUser(null)}
          onForceLogout={load}
        />
      )}
    </div>
  );
}
