// Import necessary libraries and components.
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import './App.css';

/**
 * The main application component.
 * It serves as the root layout for the application, including the navigation bar
 * and a main content area where routed pages are displayed.
 */
function App() {
  return (
    <div>
      {/* The Navbar component is displayed on all pages. */}
      <Navbar />
      <main>
        {/* The Outlet component renders the matched child route's component. */}
        <Outlet />
      </main>
    </div>
  );
}

export default App;
