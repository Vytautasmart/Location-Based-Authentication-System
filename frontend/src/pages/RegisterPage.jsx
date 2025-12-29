// Import necessary libraries and hooks from React and React Router.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Page.css';

/**
 * The registration page component.
 * It provides a form for new users to create an account.
 */
function RegisterPage() {
  // State variables for the username, password, and a success message.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  /**
   * Handles the form submission for the registration attempt.
   * It prevents the default form submission and sends a POST request to the server
   * with the new user's credentials.
   * 
   * @param {Event} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Send a POST request to the users endpoint to create a new user.
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      // If the registration is successful, show a success message and redirect to the login page.
      if (response.ok) {
        setSuccessMessage('Registration successful! You will be redirected to the login page shortly.');
        setUsername('');
        setPassword('');
        setTimeout(() => navigate('/login'), 2000); 
      } else {
        // If the registration fails, show an alert with the error message.
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

  // Render the registration form.
  return (
    <div className="page-container">
      <h1>Register</h1>
      {/* Show a success message if the registration was successful. */}
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
