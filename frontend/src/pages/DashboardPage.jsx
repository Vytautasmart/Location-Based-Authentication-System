import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Map from '../components/Map';
import AdminMetrics from '../components/AdminMetrics';
import './Page.css';
import './DashboardPage.css';

/**
 * Inline form for creating or editing a zone.
 * Handles both circular (name + radius) and w3w (name only) zone types.
 */
function ZoneModal({ zone, onSave, onCancel }) {
  const [name, setName] = useState(zone?.name || '');
  const [radius, setRadius] = useState(zone?.radius || '');
  const isW3W = zone?.type === 'w3w';

  const handleSave = () => {
    if (isW3W) onSave({ ...zone, name });
    else onSave({ ...zone, name, radius: parseFloat(radius) });
  };

  return (
    <div className="zone-form">
      <h3>{zone?.id ? 'Edit Zone' : `Create ${isW3W ? 'Grid ' : 'Circular '}Zone`}</h3>
      <label>
        Name:
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {!isW3W && (
        <label>
          Radius (meters):
          <input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </label>
      )}
      {isW3W && (
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          {zone.squares?.length || 0} grid square(s) selected
        </p>
      )}
      <div className="zone-form-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * Zone management UI (admin-only). Self-contained.
 */
function ZoneManagement() {
  const [zones, setZones] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [editingZone, setEditingZone] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSquares, setSelectedSquares] = useState([]);

  const loadZones = () => {
    const token = localStorage.getItem('token');
    fetch('/api/zones', { headers: { 'x-auth-token': token } })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error('Failed to fetch zones data');
      })
      .then((zonesData) => setZones(zonesData));
  };

  useEffect(() => { loadZones(); }, []);

  const handleCreateCircularZone = () => {
    if (!selectedPosition) {
      alert('Please drop a pin on the map first by clicking a location.');
      return;
    }
    setEditingZone({ latitude: selectedPosition.lat, longitude: selectedPosition.lng });
    setIsModalOpen(true);
  };

  const handleCreateGridZone = () => {
    if (selectedSquares.length === 0) {
      alert('Please select grid squares on the map first (zoom in to see the grid).');
      return;
    }
    setEditingZone({ type: 'w3w', squares: selectedSquares });
    setIsModalOpen(true);
  };

  const handleSaveZone = async (zone) => {
    const token = localStorage.getItem('token');
    const url = zone.id ? `/api/zones/${zone.id}` : '/api/zones';
    const method = zone.id ? 'PUT' : 'POST';
    const body = zone.type === 'w3w'
      ? { name: zone.name, type: 'w3w', squares: zone.squares }
      : { name: zone.name, type: 'circular', latitude: zone.latitude, longitude: zone.longitude, radius: zone.radius };

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setEditingZone(null);
        setSelectedPosition(null);
        setSelectedSquares([]);
        loadZones();
      } else {
        alert('Failed to save zone.');
      }
    } catch (error) {
      console.error('Failed to save zone:', error);
      alert('An error occurred while saving the zone.');
    }
  };

  const handleDeleteZone = async (zoneId) => {
    if (!window.confirm('Are you sure you want to delete this zone?')) return;
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/zones/${zoneId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token },
      });
      if (response.ok) loadZones();
      else alert('Failed to delete zone.');
    } catch (error) {
      console.error('Failed to delete zone:', error);
      alert('An error occurred while deleting the zone.');
    }
  };

  const handleMapClick = (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const zoneId = e.target.dataset.id;
      const zoneToEdit = zones.find((z) => z.id === parseInt(zoneId));
      setEditingZone(zoneToEdit);
      setIsModalOpen(true);
    } else if (e.target.classList.contains('delete-btn')) {
      const zoneId = e.target.dataset.id;
      handleDeleteZone(zoneId);
    }
  };

  return (
    <div onClick={handleMapClick}>
      <h2>Zone Management</h2>
      <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.5rem 0' }}>
        Click to drop a pin for circular zones. Zoom in to see the 3m grid — click or <b>Shift+drag</b> to select squares for grid zones.
      </p>

      <Map
        zones={zones}
        selectedPosition={selectedPosition}
        setSelectedPosition={setSelectedPosition}
        enableGrid={true}
        selectedSquares={selectedSquares}
        onSquareSelect={setSelectedSquares}
      />

      <div className="zone-form-actions" style={{ marginTop: '0.5rem' }}>
        <button onClick={handleCreateCircularZone} disabled={!selectedPosition}>Create Circular Zone</button>
        <button onClick={handleCreateGridZone} disabled={selectedSquares.length === 0}>
          Create Grid Zone {selectedSquares.length > 0 ? `(${selectedSquares.length})` : ''}
        </button>
        {selectedSquares.length > 0 && (
          <button onClick={() => setSelectedSquares([])}>Clear Selection</button>
        )}
      </div>

      {isModalOpen && (
        <ZoneModal
          zone={editingZone}
          onSave={handleSaveZone}
          onCancel={() => { setIsModalOpen(false); setEditingZone(null); }}
        />
      )}
    </div>
  );
}

/**
 * Personal overview tab — what every user sees.
 */
function OverviewTab({ user, lastLog, authLogs, zoneName }) {
  return (
    <>
      <div>
        <p>Username: {user.username}</p>
        <p>Role: {user.role}</p>
        {zoneName && <p>Logged in from zone: {zoneName}</p>}
      </div>

      {lastLog && (
        <div>
          <h3>Last Login Attempt</h3>
          <p>Timestamp: {new Date(lastLog.timestamp).toLocaleString()}</p>
          <p>Access Granted: {lastLog.access_granted ? 'Yes' : 'No'}</p>
        </div>
      )}

      <h2>My Authentication History</h2>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Granted</th>
              <th>Spoofed</th>
              <th>Verified</th>
              <th>IP</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            {authLogs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
                <td>{log.access_granted ? 'Yes' : 'No'}</td>
                <td>{log.is_spoofed ? 'Yes' : 'No'}</td>
                <td>{log.is_location_verified ? 'Yes' : 'No'}</td>
                <td>{log.ip_address}</td>
                <td>{log.latency} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function readStoredLogs() {
  try {
    const raw = localStorage.getItem('authLogs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function DashboardPage() {
  const [user, setUser] = useState(null);
  const [authLogs] = useState(readStoredLogs);
  const [lastLog] = useState(() => {
    const logs = readStoredLogs();
    return logs.length > 0 ? logs[0] : null;
  });
  const [zoneName] = useState(() => localStorage.getItem('zoneName') || '');
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }

    fetch('/api/users/me', { headers: { 'x-auth-token': token } })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error('Failed to fetch user data');
      })
      .then((userData) => setUser(userData))
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('zoneName');
        localStorage.removeItem('authLogs');
        navigate('/login');
      });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('zoneName');
    localStorage.removeItem('authLogs');
    navigate('/login');
  };

  if (!user) return <div className="page-container">Loading...</div>;

  const isAdmin = user.role === 'admin';
  const tabs = isAdmin
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'zones', label: 'Zones' },
        { id: 'metrics', label: 'Metrics' },
      ]
    : [{ id: 'overview', label: 'Overview' }];

  return (
    <div className="dashboard-container">
      <div className="dashboard-topbar">
        <h1>Dashboard</h1>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {tabs.length > 1 && (
        <div className="dashboard-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={activeTab === t.id ? 'tab active' : 'tab'}
              onClick={() => setActiveTab(t.id)}
            >{t.label}</button>
          ))}
        </div>
      )}

      <div className="dashboard-body">
        {activeTab === 'overview' && (
          <OverviewTab user={user} lastLog={lastLog} authLogs={authLogs} zoneName={zoneName} />
        )}
        {activeTab === 'zones' && isAdmin && <ZoneManagement />}
        {activeTab === 'metrics' && isAdmin && <AdminMetrics />}
      </div>
    </div>
  );
}

export default DashboardPage;
