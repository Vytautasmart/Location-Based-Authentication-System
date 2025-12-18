import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Page.css';

function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        setSuccessMessage('Registration successful! You will be redirected to the login page shortly.');
        setUsername('');
        setPassword('');
        setTimeout(() => navigate('/login'), 2000); 
      } else {
        const errorData = await response.json();
        alert(`Registration failed: ${errorData.message || 'Unknown error'}`);
        setSuccessMessage('');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('An error occurred during registration.');
      setSuccessMessage('');
    }
  };

  return (
    <div className="page-container">
      <h1>Register</h1>
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
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
        <button type="submit">Register</button>
      </form>
      <p>
        Already have an account? <a href="/login">Login here</a>.
      </p>
    </div>
  );
}

export default RegisterPage;
