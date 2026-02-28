import React, { useState, useEffect } from 'react';
import Map from '../components/Map';
import './Page.css';

/**
 * Classifies the result into a scenario type for detailed explanation.
 */
function classifyResult(status, data) {
  if (status === 0) return 'network_error';
  if (status === 400 && data.errors) return 'validation_error';
  if (status === 400) return 'bad_request';
  if (status === 401) return 'invalid_credentials';
  if (status === 403 && data.msg?.includes('spoofing')) return 'spoofed_generic';
  if (status === 403 && data.msg?.includes('VPN or proxy')) return 'spoofed_proxy';
  if (status === 403 && data.msg?.includes('network country')) return 'spoofed_country';
  if (status === 403 && data.msg?.includes('too far')) return 'spoofed_distance';
  if (status === 403 && data.msg?.includes('not in an authorized')) return 'outside_zone';
  if (status === 200 && data.message?.includes('Admin')) return 'admin_granted';
  if (status === 200 && data.access === 'granted') return 'granted';
  if (status === 500) return 'server_error';
  return 'unknown';
}

const scenarioInfo = {
  network_error: {
    title: 'Network Error',
    icon: 'X',
    color: '#856404',
    bg: '#fff3cd',
    border: '#ffc107',
    explanation: 'The request could not reach the server. This could be a network issue, CORS error, or the server may be down.',
  },
  validation_error: {
    title: 'Validation Failed',
    icon: '!',
    color: '#856404',
    bg: '#fff3cd',
    border: '#ffc107',
    explanation: 'The request was rejected because input validation failed. Check that username, password, and coordinates are in the correct format.',
  },
  bad_request: {
    title: 'Bad Request',
    icon: '!',
    color: '#856404',
    bg: '#fff3cd',
    border: '#ffc107',
    explanation: 'The server rejected the request due to invalid or missing data.',
  },
  invalid_credentials: {
    title: 'Invalid Credentials',
    icon: 'X',
    color: '#721c24',
    bg: '#f8d7da',
    border: '#f5c6cb',
    explanation: 'Authentication failed at the first step — the username or password is incorrect. Location checks are never reached because credentials are verified first.',
  },
  spoofed_proxy: {
    title: 'Spoofing Detected — VPN/Proxy',
    icon: '!',
    color: '#721c24',
    bg: '#f8d7da',
    border: '#f5c6cb',
    explanation: 'Your IP address was identified as belonging to a VPN, proxy, or hosting provider. The system blocks these because they can be used to mask your true location.',
  },
  spoofed_country: {
    title: 'Spoofing Detected — Country Mismatch',
    icon: '!',
    color: '#721c24',
    bg: '#f8d7da',
    border: '#f5c6cb',
    explanation: 'The country derived from your IP address does not match the country of the GPS coordinates you submitted. This indicates your reported location may be falsified.',
  },
  spoofed_distance: {
    title: 'Spoofing Detected — Distance Threshold',
    icon: '!',
    color: '#721c24',
    bg: '#f8d7da',
    border: '#f5c6cb',
    explanation: 'Your reported GPS location is too far from where your IP address geolocates. This fallback check triggers when country-level comparison is unavailable.',
  },
  spoofed_generic: {
    title: 'Spoofing Detected',
    icon: '!',
    color: '#721c24',
    bg: '#f8d7da',
    border: '#f5c6cb',
    explanation: 'The system detected that your reported location may be spoofed based on IP geolocation analysis.',
  },
  outside_zone: {
    title: 'Outside Authorized Zone',
    icon: 'X',
    color: '#721c24',
    bg: '#f8d7da',
    border: '#f5c6cb',
    explanation: 'Credentials are valid and no spoofing was detected, but the GPS coordinates are not within any authorized zone. The user must be physically inside a zone to gain access.',
  },
  admin_granted: {
    title: 'Access Granted — Admin Bypass',
    icon: '\u2713',
    color: '#155724',
    bg: '#d4edda',
    border: '#c3e6cb',
    explanation: 'Admin users bypass all location checks. Access was granted solely based on valid credentials, regardless of the submitted coordinates.',
  },
  granted: {
    title: 'Access Granted',
    icon: '\u2713',
    color: '#155724',
    bg: '#d4edda',
    border: '#c3e6cb',
    explanation: 'Credentials are valid, no spoofing detected, and the GPS coordinates fall within an authorized zone. A JWT token and refresh token were issued.',
  },
  server_error: {
    title: 'Server Error',
    icon: 'X',
    color: '#721c24',
    bg: '#f8d7da',
    border: '#f5c6cb',
    explanation: 'An internal server error occurred during authentication. Check the server logs for details.',
  },
  unknown: {
    title: 'Unknown Response',
    icon: '?',
    color: '#856404',
    bg: '#fff3cd',
    border: '#ffc107',
    explanation: 'The server returned an unexpected response.',
  },
};

/**
 * Demo page for testing location-based authentication scenarios.
 */
function DemoPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [zones, setZones] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setZones(data))
      .catch(() => setZones([]));
  }, []);

  useEffect(() => {
    if (selectedPosition) {
      setLatitude(selectedPosition.lat.toFixed(6));
      setLongitude(selectedPosition.lng.toFixed(6));
    }
  }, [selectedPosition]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
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

  const handleTest = async (e) => {
    e.preventDefault();
    setResult(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        }),
      });

      const data = await response.json();
      setResult({ status: response.status, success: response.ok, data });
    } catch (error) {
      setResult({
        status: 0,
        success: false,
        data: { msg: 'Network error: ' + error.message },
      });
    } finally {
      setLoading(false);
    }
  };

  const scenario = result ? classifyResult(result.status, result.data) : null;
  const info = scenario ? scenarioInfo[scenario] : null;

  return (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      <h1>Demo Scenarios</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem' }}>
        Test location-based authentication by entering credentials and selecting a location.
        The map shows authorized zones — try locations inside and outside them.
      </p>

      <h3>1. Select Location</h3>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>Click the map or enter coordinates manually.</p>
      <Map zones={zones} selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} showZoneActions={false} />

      <div style={{ display: 'flex', gap: '1rem', margin: '1rem 0', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="demo-lat">Latitude: </label>
          <input
            id="demo-lat"
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            style={{ width: '150px', padding: '0.4rem' }}
          />
        </div>
        <div>
          <label htmlFor="demo-lng">Longitude: </label>
          <input
            id="demo-lng"
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            style={{ width: '150px', padding: '0.4rem' }}
          />
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          style={{ padding: '0.4rem 1rem', cursor: 'pointer' }}
        >
          Use My Location
        </button>
      </div>

      <h3>2. Enter Credentials</h3>
      <form onSubmit={handleTest} className="form-container">
        <div>
          <label htmlFor="demo-user">Username:</label>
          <input
            id="demo-user"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="demo-pass">Password:</label>
          <input
            id="demo-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading || !latitude || !longitude}>
          {loading ? 'Testing...' : '3. Test Authentication'}
        </button>
      </form>

      {result && info && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1.2rem',
          borderRadius: '8px',
          backgroundColor: info.bg,
          border: `1px solid ${info.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%', backgroundColor: info.color,
              color: '#fff', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0,
            }}>{info.icon}</span>
            <h3 style={{ color: info.color, margin: 0 }}>{info.title}</h3>
          </div>

          <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {info.explanation}
          </p>

          <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
            <p style={{ margin: '0.25rem 0' }}><strong>HTTP Status:</strong> {result.status}</p>
            {result.data.msg && <p style={{ margin: '0.25rem 0' }}><strong>Server Message:</strong> {result.data.msg}</p>}
            {result.data.message && <p style={{ margin: '0.25rem 0' }}><strong>Server Message:</strong> {result.data.message}</p>}
            {result.data.zoneName && <p style={{ margin: '0.25rem 0' }}><strong>Matched Zone:</strong> {result.data.zoneName}</p>}
            {result.data.access && <p style={{ margin: '0.25rem 0' }}><strong>Access Decision:</strong> {result.data.access}</p>}
            {result.data.errors && (
              <div style={{ margin: '0.5rem 0' }}>
                <strong>Validation Errors:</strong>
                <ul style={{ margin: '0.25rem 0', paddingLeft: '1.2rem' }}>
                  {result.data.errors.map((err, i) => (
                    <li key={i}>{err.field}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Authentication Flow</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.75rem' }}>
          Each request goes through these checks in order. Failure at any step stops the flow:
        </p>
        <ol style={{ lineHeight: '2', fontSize: '0.9rem', paddingLeft: '1.2rem' }}>
          <li><strong>Input Validation</strong> — Username (3-50 chars), password (8-128 chars), coordinates (valid lat/lng range)</li>
          <li><strong>Credential Verification</strong> — Username and password checked against the database (bcrypt)</li>
          <li><strong>Spoofing Detection</strong> — IP geolocation compared against submitted GPS coordinates (country-level match). VPN/proxy detection via ip-api.com and ipinfo.io</li>
          <li><strong>Zone Verification</strong> — GPS coordinates checked against circular zones (Haversine distance) and grid zones (3m cell ID match)</li>
          <li><strong>Access Decision</strong> — JWT access token (15 min) and refresh token (7 days) issued on success</li>
        </ol>
        <p style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.5rem' }}>
          <strong>Note:</strong> Admin users skip steps 3 and 4 — they are granted access with valid credentials alone.
        </p>
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Suggested Test Scenarios</h3>
        <ul style={{ lineHeight: '2', fontSize: '0.9rem' }}>
          <li><strong>Granted — inside zone:</strong> Valid credentials + click inside a blue/red zone on the map</li>
          <li><strong>Denied — outside zone:</strong> Valid credentials + click in an empty area far from any zone</li>
          <li><strong>Denied — wrong password:</strong> Correct username but wrong password</li>
          <li><strong>Denied — nonexistent user:</strong> Enter a username that doesn't exist</li>
          <li><strong>Denied — spoofed location:</strong> Valid credentials + coordinates in a different country (e.g. lat: 35.6762, lng: 139.6503 for Tokyo)</li>
          <li><strong>Admin bypass:</strong> Log in as an admin — any coordinates will be accepted</li>
          <li><strong>Validation error:</strong> Leave username empty, or enter lat: 999 to trigger input validation</li>
        </ul>
      </div>
    </div>
  );
}

export default DemoPage;
