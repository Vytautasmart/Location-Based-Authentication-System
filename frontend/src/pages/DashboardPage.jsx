import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Map from '../components/Map';

function ZoneModal({ zone, onSave, onCancel }) {
  const [name, setName] = useState(zone ? zone.name : '');
  const [radius, setRadius] = useState(zone ? zone.radius : '');

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


function DashboardPage() {
  const [user, setUser] = useState(null);
  const [zones, setZones] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [editingZone, setEditingZone] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

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

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch('/api/users/me', {
      headers: { 'x-auth-token': token },
    })
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error('Failed to fetch user data');
      })
      .then((userData) => {
        setUser(userData);
        if (userData.role === 'admin') {
          loadZones();
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login');
      });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

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

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div onClick={handleMapClick}>
      <h1>Welcome to your Dashboard</h1>
      <div>
        <p>Username: {user.username}</p>
        <p>Role: {user.role}</p>
      </div>
      <button onClick={handleLogout}>Logout</button>

      {user.role === 'admin' && (
        <div>
          <h2>Zone Management</h2>
          <Map zones={zones} selectedPosition={selectedPosition} setSelectedPosition={setSelectedPosition} />
          <button onClick={handleCreateZone}>Create Zone from Selected Location</button>
        </div>
      )}

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
