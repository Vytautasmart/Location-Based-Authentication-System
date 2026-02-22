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
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
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
        setConfirmPassword('');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        // If the registration fails, show an alert with the error message.
        const errorData = await response.json();
        // Handle validation errors (msg + errors array) and general errors (message)
        let errorMsg = errorData.message || errorData.msg || 'Unknown error';
        if (errorData.errors && errorData.errors.length > 0) {
          errorMsg = errorData.errors.map(e => e.message).join('\n');
        }
        alert(`Registration failed:\n${errorMsg}`);
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
            minLength={8}
          />
          <small style={{ color: '#888', marginTop: '0.3rem' }}>
            Min 8 characters, with uppercase, lowercase, number, and special character.
          </small>
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
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
