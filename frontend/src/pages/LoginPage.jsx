import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Page.css';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch('/api/auth/access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password, latitude, longitude }),
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('token', data.token);
          if (data.zoneName) {
            localStorage.setItem('zoneName', data.zoneName);
          }
          if (data.authLogs) {
            localStorage.setItem('authLogs', JSON.stringify(data.authLogs));
          }
          navigate('/dashboard');
        } else {
          const errorData = await response.json();
          alert(`Login failed: ${errorData.msg}`);
        }
      } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login.');
      }
    }, () => {
      alert('Unable to retrieve your location');
    });
  };

  return (
    <div className="page-container">
      <h1>Login</h1>
      <form onSubmit={handleSubmit} className="form-container">
        <div>
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default LoginPage;
