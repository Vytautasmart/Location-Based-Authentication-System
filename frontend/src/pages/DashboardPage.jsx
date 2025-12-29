// Import necessary libraries and components from React and React Router.
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Map from '../components/Map';
import './Page.css';

/**
 * A modal component for creating or editing a zone.
 * It provides a form for entering the zone's name and radius.
 * 
 * @param {object} props - The component's props.
 * @param {object} props.zone - The zone to be edited, or null for a new zone.
 * @param {Function} props.onSave - A callback function to save the zone.
 * @param {Function} props.onCancel - A callback function to cancel the operation.
 * @returns {JSX.Element} The zone modal.
 */
function ZoneModal({ zone, onSave, onCancel }) {
  // State for the zone's name and radius.
  const [name, setName] = useState(zone ? zone.name : '');
  const [radius, setRadius] = useState(zone ? zone.radius : '');

  // Handles the save operation by calling the onSave callback with the updated zone data.
  const handleSave = () => {
    onSave({ ...zone, name, radius: parseFloat(radius) });
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>{zone ? 'Edit Zone' : 'Create Zone'}</h2>
        <label>
          Name:
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Radius (meters):
          <input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </label>
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/**
 * The main dashboard page for authenticated users.
 * It displays user information, authentication logs, and zone management tools for admins.
 */
function DashboardPage() {
  // State variables for user data, zones, map interactions, and UI elements.
  const [user, setUser] = useState(null);
  const [zones, setZones] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [editingZone, setEditingZone] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [authLogs, setAuthLogs] = useState([]);
  const [lastLog, setLastLog] = useState(null);
  const navigate = useNavigate();

  // Fetches the list of authorized zones from the server.
  const loadZones = () => {
    const token = localStorage.getItem('token');
    fetch('/api/zones', {
      headers: { 'x-auth-token': token },
    })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error('Failed to fetch zones data');
      })
      .then((zonesData) => setZones(zonesData));
  };

  // Effect hook to fetch user data and zones on component mount.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Load zone name and auth logs from local storage.
    const storedZoneName = localStorage.getItem('zoneName');
    if (storedZoneName) {
      setZoneName(storedZoneName);
    }

    const storedAuthLogs = localStorage.getItem('authLogs');
    if (storedAuthLogs) {
      const parsedLogs = JSON.parse(storedAuthLogs);
      setAuthLogs(parsedLogs);
      if (parsedLogs.length > 0) {
        setLastLog(parsedLogs[0]);
      }
    }

    // Fetch the current user's data.
    fetch('/api/users/me', {
      headers: { 'x-auth-token': token },
    })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error('Failed to fetch user data');
      })
      .then((userData) => {
        setUser(userData);
        // If the user is an admin, load the zones.
        if (userData.role === 'admin') {
          loadZones();
        }
      })
      .catch(() => {
        // If fetching fails, clear local storage and redirect to login.
        localStorage.removeItem('token');
        localStorage.removeItem('zoneName');
        localStorage.removeItem('authLogs');
        navigate('/login');
      });
  }, [navigate]);

  // Handles the user logout process.
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('zoneName');
    localStorage.removeItem('authLogs');
    navigate('/login');
  };

  // Opens the modal to create a new zone at the selected map location.
  const handleCreateZone = () => {
    if (selectedPosition) {
      setEditingZone({
        latitude: selectedPosition.lat,
        longitude: selectedPosition.lng,
      });
      setIsModalOpen(true);
    } else {
      alert('Please select a location on the map first.');
    }
  };

  // Saves a new or existing zone to the server.
  const handleSaveZone = async (zone) => {
    const token = localStorage.getItem('token');
    const url = zone.id ? `/api/zones/${zone.id}` : '/api/zones';
    const method = zone.id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(zone),
      });

      if (response.ok) {
        setIsModalOpen(false);
        setEditingZone(null);
        setSelectedPosition(null);
        loadZones();
      } else {
        alert('Failed to save zone.');
      }
    } catch (error) {
      console.error('Failed to save zone:', error);
      alert('An error occurred while saving the zone.');
    }
  };

  // Deletes a zone after confirmation.
  const handleDeleteZone = async (zoneId) => {
    if (window.confirm('Are you sure you want to delete this zone?')) {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch(`/api/zones/${zoneId}`, {
          method: 'DELETE',
          headers: { 'x-auth-token': token },
        });

        if (response.ok) {
          loadZones();
        } else {
          alert('Failed to delete zone.');
        }
      } catch (error) {
        console.error('Failed to delete zone:', error);
        alert('An error occurred while deleting the zone.');
      }
    }
  };
  
  // Handles clicks on the map, specifically for editing or deleting zones from popups.
  const handleMapClick = (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const zoneId = e.target.dataset.id;
      const zoneToEdit = zones.find(z => z.id === parseInt(zoneId));
      setEditingZone(zoneToEdit);
      setIsModalOpen(true);
    } else if (e.target.classList.contains('delete-btn')) {
      const zoneId = e.target.dataset.id;
      handleDeleteZone(zoneId);
    }
  };

  // Show a loading message while user data is being fetched.
  if (!user) {
    return <div className="page-container">Loading...</div>;
  }

  // Render the main dashboard content.
  return (
    <div className="page-container" onClick={handleMapClick}>
      <h1>Welcome to your Dashboard</h1>
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
      <button onClick={handleLogout}>Logout</button>

      {/* Only show the Zone Management section to admin users. */}
      {user.role === 'admin' && (
        <div>
          <h2>Zone Management</h2>
          <Map zones={zones} selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} />
          <button onClick={handleCreateZone}>Create Zone from Selected Location</button>
        </div>
      )}

      <h2>Authentication Logs</h2>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Access Granted</th>
            <th>Spoofed</th>
            <th>Verified Location</th>
            <th>IP Address</th>
            <th>Client Latitude</th>
            <th>Client Longitude</th>
            <th>IP Latitude</th>
            <th>IP Longitude</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {/* Map over the authentication logs to display them in a table. */}
          {authLogs.map(log => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.access_granted ? 'Yes' : 'No'}</td>
              <td>{log.is_spoofed ? 'Yes' : 'No'}</td>
              <td>{log.is_location_verified ? 'Yes' : 'No'}</td>
              <td>{log.ip_address}</td>
              <td>{log.client_latitude}</td>
              <td>{log.client_longitude}</td>
              <td>{log.ip_latitude}</td>
              <td>{log.ip_longitude}</td>
              <td>{log.latency}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Show the ZoneModal if it is open. */}
      {isModalOpen && (
        <ZoneModal
          zone={editingZone}
          onSave={handleSaveZone}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingZone(null);
          }}
        />
      )}
    </div>
  );
}

export default DashboardPage;
