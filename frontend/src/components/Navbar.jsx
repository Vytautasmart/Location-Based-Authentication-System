// Import necessary libraries and components.
import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

/**
 * The navigation bar component.
 * It provides links to navigate between different pages in the application.
 */
function Navbar() {
  return (
    <nav>
      <ul>
        <li>
          {/* Link to the login page. */}
          <Link to="/login">Login</Link>
        </li>
        <li>
          {/* Link to the registration page. */}
          <Link to="/register">Register</Link>
        </li>
        <li>
          {/* Link to the dashboard page. */}
          <Link to="/dashboard">Dashboard</Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
