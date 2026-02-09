import React, { useState, useEffect } from 'react';
import Map from '../components/Map';
import './Page.css';

/**
 * Demo page for testing location-based authentication scenarios.
 * Allows users to input coordinates (or select on map), provide credentials,
 * and test the access endpoint to see grant/deny results.
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

  // Load zones on mount so the map shows authorized areas
  useEffect(() => {
    fetch('/api/zones')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setZones(data))
      .catch(() => setZones([]));
  }, []);

  // Sync map selection with coordinate inputs
  useEffect(() => {
    if (selectedPosition) {
      setLatitude(selectedPosition.lat.toFixed(6));
      setLongitude(selectedPosition.lng.toFixed(6));
    }
  }, [selectedPosition]);

  // Use browser geolocation to fill in current position
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

  // Submit the test scenario to the access endpoint
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
      setResult({
        status: response.status,
        success: response.ok,
        data,
      });
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

  return (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      <h1>Demo Scenarios</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem' }}>
        Test location-based authentication by entering credentials and selecting a location.
        The map shows authorized zones — try locations inside and outside them.
      </p>

      <h3>1. Select Location</h3>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>Click the map or enter coordinates manually.</p>
      <Map zones={zones} selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} />

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

      {result && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: result.success ? '#d4edda' : '#f8d7da',
          border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`,
        }}>
          <h3 style={{ color: result.success ? '#155724' : '#721c24', margin: '0 0 0.5rem' }}>
            {result.success ? 'Access Granted' : 'Access Denied'}
          </h3>
          <p><strong>HTTP Status:</strong> {result.status}</p>
          {result.data.msg && <p><strong>Message:</strong> {result.data.msg}</p>}
          {result.data.message && <p><strong>Message:</strong> {result.data.message}</p>}
          {result.data.zoneName && <p><strong>Zone:</strong> {result.data.zoneName}</p>}
          {result.data.access && <p><strong>Access:</strong> {result.data.access}</p>}
        </div>
      )}

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Suggested Test Scenarios</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Successful login:</strong> Use valid credentials and click inside an authorized zone on the map.</li>
          <li><strong>Denied by location:</strong> Use valid credentials but click outside all authorized zones.</li>
          <li><strong>Invalid credentials:</strong> Use a wrong password to see credential verification fail first.</li>
          <li><strong>Admin bypass:</strong> Log in as an admin user — location checks are bypassed.</li>
        </ul>
      </div>
    </div>
  );
}

export default DemoPage;
