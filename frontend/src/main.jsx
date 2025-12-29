// Import necessary libraries and components.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

// Import Leaflet CSS for map display.
import 'leaflet/dist/leaflet.css';

// Import global styles and the main App component.
import './index.css';
import App from './App.jsx';

// Import page components for routing.
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

// Configure the browser router with different paths.
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    // Define nested routes for different pages.
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
    ],
  },
]);

// Get the root element from the HTML.
const rootElement = document.getElementById('root');

// Create a root for the React application.
const root = createRoot(rootElement);

// Render the application within a StrictMode for development checks.
root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
