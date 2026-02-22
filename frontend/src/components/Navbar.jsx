import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const closeMenu = () => setMenuOpen(false);
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/login" className="navbar-brand" onClick={closeMenu}>
        <span className="brand-icon">🔐</span>
        <span className="brand-text">LBAS</span>
      </Link>

      <button
        className={`hamburger ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle navigation"
      >
        <span />
        <span />
        <span />
      </button>

      <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
        <li>
          <Link to="/login" className={isActive('/login') ? 'active' : ''} onClick={closeMenu}>Login</Link>
        </li>
        <li>
          <Link to="/register" className={isActive('/register') ? 'active' : ''} onClick={closeMenu}>Register</Link>
        </li>
        <li>
          <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''} onClick={closeMenu}>Dashboard</Link>
        </li>
        <li>
          <Link to="/demo" className={isActive('/demo') ? 'active' : ''} onClick={closeMenu}>Demo</Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
