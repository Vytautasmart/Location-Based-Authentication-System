// Import necessary libraries and hooks from React and React Router.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Page.css';

/**
 * The login page component.
 * It provides a form for users to log in with their username and password,
 * and it uses the browser's Geolocation API to include their location in the login attempt.
 */
function LoginPage() {
  // State variables for the username and password fields.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  /**
   * Handles the form submission for the login attempt.
   * It prevents the default form submission, gets the user's current location,
   * and sends a POST request to the server with the login credentials and location.
   * 
   * @param {Event} e - The form submission event.
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    // Check if the browser supports geolocation.
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    // Get the user's current position.
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        // Send a POST request to the access endpoint with the user's credentials and location.
        const response = await fetch('/api/auth/access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password, latitude, longitude }),
        });

        // If the login is successful, store the token and other data in local storage and navigate to the dashboard.
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
          // If the login fails, show an alert with the error message.
          const errorData = await response.json();
          alert(`Login failed: ${errorData.msg}`);
        }
      } catch (error) {
        console.error('Login error:', error);
        alert('An error occurred during login.');
      }
    }, () => {
      // Handle errors in retrieving the user's location.
      alert('Unable to retrieve your location');
    });
  };

  // Render the login form.
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
