import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Map from '../components/Map';

function DashboardPage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch('/api/users/me', {
      headers: {
        'x-auth-token': token,
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to fetch user data');
      })
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login');
      });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Welcome to your Dashboard</h1>
      <div>
        <p>Username: {user.username}</p>
        <p>Role: {user.role}</p>
      </div>
      <button onClick={handleLogout}>Logout</button>

      {user.role === 'admin' && (
        <div>
          <h2>Zone Management</h2>
          <Map />
          <button>Create Zone from Selected Location</button>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
