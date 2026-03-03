import { useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const flowSteps = [
  {
    title: 'Input Validation',
    desc: 'Validates credential format (alphanumeric username, password complexity) and ensures GPS coordinates are present before processing the request.',
    details: [
      {
        heading: 'Middleware: express-validator',
        text: 'The validation layer uses express-validator to check request bodies before they reach the route handler. Username must be alphanumeric (3+ chars), password must meet complexity requirements (8+ chars, uppercase, lowercase, number, special character).',
      },
      {
        heading: 'Location data requirement',
        text: 'The /api/auth/access endpoint requires latitude and longitude fields as numeric values. If either is missing or non-numeric, the request is rejected with a 400 status before any database queries are made.',
      },
      {
        heading: 'Implementation',
        code: 'POST /api/auth/access\n\nRequired body:\n  username:  string (alphanumeric, 3+ chars)\n  password:  string (8+ chars, mixed case + number + special)\n  latitude:  number (-90 to 90)\n  longitude: number (-180 to 180)',
      },
    ],
  },
  {
    title: 'Credential Verification',
    desc: 'Authenticates the user against the PostgreSQL database using bcrypt timing-safe password comparison to prevent enumeration attacks.',
    details: [
      {
        heading: 'Passport.js Local Strategy',
        text: 'Authentication is handled by Passport.js using the Local Strategy. The strategy queries the users table by username, then uses bcrypt.compare() to verify the password against the stored hash.',
      },
      {
        heading: 'Timing-safe comparison',
        text: 'bcrypt.compare() is inherently timing-safe \u2014 it always runs the full comparison regardless of where a mismatch occurs. This prevents attackers from determining how many characters of a password are correct based on response time.',
      },
      {
        heading: 'Failure response',
        code: 'On failure (401 Unauthorized):\n{\n  "message": "Invalid credentials"\n}\n\nNote: The same error message is returned whether\nthe username doesn\'t exist or the password is wrong,\npreventing user enumeration.',
      },
    ],
  },
  {
    title: 'Spoofing Detection',
    desc: 'Cross-references the client\'s GPS coordinates with their IP-derived geolocation from multiple providers (ip-api.com, ipinfo.io). Detects VPN/proxy usage and flags country-level mismatches.',
    details: [
      {
        heading: 'Multi-source IP geolocation',
        text: 'Two independent geolocation providers are queried in parallel: ip-api.com (free, 45 req/min) and ipinfo.io (free tier, 50k req/month). Results are cross-referenced for reliability. If either detects a VPN, proxy, or Tor exit node, access is denied immediately.',
      },
      {
        heading: 'Country-level cross-referencing',
        text: 'The client\'s GPS coordinates are reverse-geocoded via OpenStreetMap Nominatim to get a country code. This is compared against the IP-derived country. A mismatch (e.g., IP says "US" but GPS says "GB") triggers a spoofing flag with reason "country_mismatch".',
      },
      {
        heading: 'Distance fallback',
        text: 'If country-level comparison is unavailable (API timeout, missing data), the system falls back to a 500km distance threshold between the GPS and IP-derived coordinates using the Haversine formula.',
      },
      {
        heading: 'Detection outcomes',
        code: 'Spoofing reasons:\n  "proxy"            \u2192 VPN/proxy/Tor detected\n  "country_mismatch" \u2192 IP country \u2260 GPS country\n  "distance"         \u2192 IP-GPS distance > 500km\n\nResponse includes: ipLatitude, ipLongitude,\n  ipCountry, gpsCountry, isSpoofed, reason',
      },
    ],
  },
  {
    title: 'Zone Verification',
    desc: 'Checks microgrid zones first (3m x 3m precision using coordinate math), then falls back to circular zones using the Haversine formula for distance calculation.',
    details: [
      {
        heading: 'Microgrid zones (priority)',
        text: 'The Earth is divided into a grid of 3m x 3m cells using coordinate math. Each cell has a deterministic ID based on its row and column (e.g., "1911781.-4701"). The user\'s GPS coordinates are converted to a cell ID and matched against stored grid zone squares in the database.',
      },
      {
        heading: 'Grid math',
        code: 'Cell size:  3 metres\nLat step:   3 / 111320 degrees\nLng step:   3 / (111320 \u00D7 cos(latitude)) degrees\n\nCell ID = floor(lat / latStep) . floor(lng / lngStep)\nExample: 51.5074, -0.1278 \u2192 "1911781.-4701"',
      },
      {
        heading: 'Circular zones (fallback)',
        text: 'If no microgrid zone match is found, the system checks circular zones. Each circular zone has a center point (lat/lng) and a radius in metres. The Haversine formula calculates the great-circle distance between the user and the zone center.',
      },
      {
        heading: 'Haversine formula',
        code: 'a = sin\u00B2(\u0394lat/2) + cos(lat1) \u00D7 cos(lat2) \u00D7 sin\u00B2(\u0394lng/2)\nc = 2 \u00D7 atan2(\u221Aa, \u221A(1-a))\nd = R \u00D7 c   (R = 6,371,000 metres)\n\nIf d \u2264 zone.radius \u2192 user is inside the zone',
      },
    ],
  },
  {
    title: 'Access Decision',
    desc: 'Grants or denies access based on all preceding checks. Admin users bypass location verification. The full attempt is logged to the audit trail with latency metrics.',
    details: [
      {
        heading: 'Role-based bypass',
        text: 'Users with the "admin" role are granted access regardless of their location. This allows administrators to manage the system remotely. Regular users must pass both spoofing detection and zone verification.',
      },
      {
        heading: 'JWT token issuance',
        text: 'On successful access, the server issues a JWT access token (15-minute expiry, HS256 algorithm) in the response body and a refresh token (7-day expiry) as an HTTPOnly secure cookie with SameSite=strict.',
      },
      {
        heading: 'Audit logging',
        text: 'Every access attempt is recorded in the auth_logs table: user ID, client coordinates, IP-derived coordinates, spoofing detection result and reason, matched zone name, access decision, and verification latency in milliseconds.',
      },
      {
        heading: 'Response format',
        code: 'Access granted (200):\n{\n  "access": "granted",\n  "message": "User is in an authorized location.",\n  "token": "eyJhbG...",\n  "user": { "id": 1, "username": "...", "role": "user" },\n  "location": { "zoneName": "Office", ... },\n  "spoofCheck": { "isSpoofed": false, ... }\n}\n\nAccess denied (403):\n{\n  "access": "denied",\n  "message": "User is not in an authorized location."\n}',
      },
    ],
  },
];

const apiRoutes = [
  { method: 'POST', path: '/api/auth/login', auth: 'None', desc: 'Authenticate user, return JWT' },
  { method: 'POST', path: '/api/auth/access', auth: 'None', desc: 'Full auth + location verification flow' },
  { method: 'POST', path: '/api/auth/refresh', auth: 'Cookie', desc: 'Refresh access token (rotation)' },
  { method: 'POST', path: '/api/auth/logout', auth: 'Cookie', desc: 'Invalidate refresh token' },
  { method: 'GET', path: '/api/zones', auth: 'None', desc: 'List all authorized zones' },
  { method: 'POST', path: '/api/zones', auth: 'JWT (admin)', desc: 'Create authorized zone' },
  { method: 'PUT', path: '/api/zones/:id', auth: 'JWT (admin)', desc: 'Update authorized zone' },
  { method: 'DELETE', path: '/api/zones/:id', auth: 'JWT (admin)', desc: 'Delete authorized zone' },
  { method: 'POST', path: '/api/users', auth: 'None', desc: 'Register new user' },
  { method: 'GET', path: '/api/users/me', auth: 'JWT', desc: 'Get authenticated user profile' },
];

const schemaTables = [
  {
    name: 'users',
    icon: '\u{1F464}',
    cols: [
      { name: 'id', tag: 'PK', type: 'SERIAL' },
      { name: 'username', type: 'VARCHAR UNIQUE' },
      { name: 'password_hash', type: 'VARCHAR' },
      { name: 'role', type: "VARCHAR ('admin'|'user')" },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
  },
  {
    name: 'authorized_zones',
    icon: '\u{1F4CD}',
    cols: [
      { name: 'id', tag: 'PK', type: 'SERIAL' },
      { name: 'name', type: 'VARCHAR' },
      { name: 'type', type: "VARCHAR ('circular'|'w3w')" },
      { name: 'latitude', type: 'FLOAT (nullable)' },
      { name: 'longitude', type: 'FLOAT (nullable)' },
      { name: 'radius', type: 'FLOAT (nullable)' },
      { name: 'center_latitude', type: 'FLOAT' },
      { name: 'center_longitude', type: 'FLOAT' },
    ],
  },
  {
    name: 'w3w_zone_squares',
    icon: '\u{1F9E9}',
    cols: [
      { name: 'id', tag: 'PK', type: 'SERIAL' },
      { name: 'zone_id', tag: 'FK', type: 'INT \u2192 authorized_zones' },
      { name: 'words', type: 'VARCHAR (grid cell ID)' },
      { name: 'latitude', type: 'FLOAT' },
      { name: 'longitude', type: 'FLOAT' },
    ],
  },
  {
    name: 'auth_logs',
    icon: '\u{1F4CB}',
    cols: [
      { name: 'id', tag: 'PK', type: 'SERIAL' },
      { name: 'user_id', tag: 'FK', type: 'INT \u2192 users' },
      { name: 'access', type: "VARCHAR ('granted'|'denied')" },
      { name: 'ip_address', type: 'VARCHAR' },
      { name: 'client_latitude', type: 'FLOAT' },
      { name: 'client_longitude', type: 'FLOAT' },
      { name: 'ip_latitude', type: 'FLOAT' },
      { name: 'ip_longitude', type: 'FLOAT' },
      { name: 'spoofing_detected', type: 'BOOLEAN' },
      { name: 'spoofing_reason', type: 'VARCHAR' },
      { name: 'zone_name', type: 'VARCHAR' },
      { name: 'latency_ms', type: 'INT' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
  },
  {
    name: 'refresh_tokens',
    icon: '\u{1F510}',
    cols: [
      { name: 'id', tag: 'PK', type: 'SERIAL' },
      { name: 'user_id', tag: 'FK', type: 'INT \u2192 users' },
      { name: 'token_hash', type: 'VARCHAR' },
      { name: 'expires_at', type: 'TIMESTAMP' },
      { name: 'created_at', type: 'TIMESTAMP' },
    ],
  },
];

const securityFeatures = [
  {
    icon: '\u{1F512}',
    title: 'HTTPS & Security Headers',
    desc: 'HSTS enforcement, Helmet.js security headers, and Content Security Policy to prevent XSS and injection attacks.',
  },
  {
    icon: '\u{1F3AB}',
    title: 'JWT Token System',
    desc: 'Short-lived access tokens (15-min, HS256) with secure refresh token rotation (7-day expiry) stored as hashed values.',
  },
  {
    icon: '\u{1F511}',
    title: 'bcrypt Password Hashing',
    desc: 'Passwords hashed with bcrypt using adaptive cost factor. Timing-safe comparison prevents credential enumeration.',
  },
  {
    icon: '\u{26A1}',
    title: 'Rate Limiting',
    desc: '100 requests per 15-minute window on authentication endpoints to mitigate brute-force attacks.',
  },
  {
    icon: '\u{1F310}',
    title: 'CORS & Origin Control',
    desc: 'Strict CORS policy restricting API access to authorized frontend origins with SameSite cookie attributes.',
  },
  {
    icon: '\u{1F6E1}\u{FE0F}',
    title: 'Spoofing Detection',
    desc: 'Multi-source IP geolocation (ip-api.com + ipinfo.io) with country-level GPS cross-referencing and VPN/proxy detection.',
  },
];

function LandingPage() {
  const [expandedStep, setExpandedStep] = useState(null);

  const toggleStep = (i) => {
    setExpandedStep(expandedStep === i ? null : i);
  };

  return (
    <div className="landing">
      {/* Hero */}
      <section className="landing-hero">
        <div className="hero-label">Final Year Project</div>
        <h1>Location-Based Authentication System</h1>
        <p>
          A responsive web application that grants or denies access based on user
          location combined with credential verification. The system collects
          real-time GPS data during login attempts and compares it against trusted
          authorized zones stored in the database.
        </p>
        <div className="hero-actions">
          <Link to="/demo" className="btn-primary">Try the Demo</Link>
          <Link to="/login" className="btn-outline">Login</Link>
          <Link to="/register" className="btn-outline">Register</Link>
        </div>
      </section>

      {/* Tech stack pills */}
      <div className="tech-pills" style={{ justifyContent: 'center' }}>
        {[
          ['Express.js 5', '\u{2699}\u{FE0F}'],
          ['React 19', '\u{269B}\u{FE0F}'],
          ['PostgreSQL', '\u{1F418}'],
          ['Passport.js', '\u{1F6C2}'],
          ['Leaflet', '\u{1F5FA}\u{FE0F}'],
          ['JWT', '\u{1F3AB}'],
          ['Vite', '\u{26A1}'],
        ].map(([name, icon]) => (
          <span className="tech-pill" key={name}>
            <span>{icon}</span> {name}
          </span>
        ))}
      </div>

      {/* How It Works */}
      <section className="landing-section">
        <div className="section-header">
          <span className="section-number">01</span>
          <h2>Authentication Flow</h2>
        </div>
        <p className="section-hint">Click a step to see implementation details</p>
        <div className="flow-steps">
          {flowSteps.map((step, i) => (
            <div key={i}>
              <div
                className={`flow-step ${expandedStep === i ? 'flow-step-active' : ''}`}
                onClick={() => toggleStep(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleStep(i)}
              >
                <div className="step-num">{i + 1}</div>
                <div className="step-content">
                  <div className="step-header-row">
                    <h3>{step.title}</h3>
                    <span className={`step-chevron ${expandedStep === i ? 'step-chevron-open' : ''}`} />
                  </div>
                  <p>{step.desc}</p>
                </div>
              </div>
              <div className={`step-details ${expandedStep === i ? 'step-details-open' : ''}`}>
                <div className="step-details-inner">
                  {step.details.map((d, j) => (
                    <div className="detail-block" key={j}>
                      <h4>{d.heading}</h4>
                      {d.text && <p>{d.text}</p>}
                      {d.code && <pre className="detail-code">{d.code}</pre>}
                    </div>
                  ))}
                </div>
              </div>
              {i < flowSteps.length - 1 && (
                <div className="step-connector"><span /></div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* API Routes */}
      <section className="landing-section">
        <div className="section-header">
          <span className="section-number">02</span>
          <h2>API Endpoints</h2>
        </div>
        <div className="api-table-wrap">
          <table className="api-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Auth</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {apiRoutes.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className={`method-badge method-${r.method.toLowerCase()}`}>
                      {r.method}
                    </span>
                  </td>
                  <td><span className="route-path">{r.path}</span></td>
                  <td><span className="auth-badge">{r.auth}</span></td>
                  <td>{r.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Database Schema */}
      <section className="landing-section">
        <div className="section-header">
          <span className="section-number">03</span>
          <h2>Database Schema</h2>
        </div>
        <div className="schema-grid">
          {schemaTables.map((t) => (
            <div className="schema-table" key={t.name}>
              <div className="schema-table-header">
                <span>{t.icon}</span> {t.name}
              </div>
              <ul className="schema-columns">
                {t.cols.map((c) => (
                  <li key={c.name}>
                    <span className="col-name">{c.name}</span>
                    {c.tag === 'PK' && <span className="col-key">PK</span>}
                    {c.tag === 'FK' && <span className="col-fk">FK</span>}
                    <span className="col-type">{c.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="landing-section">
        <div className="section-header">
          <span className="section-number">04</span>
          <h2>Security Features</h2>
        </div>
        <div className="security-grid">
          {securityFeatures.map((f, i) => (
            <div className="security-item" key={i}>
              <span className="security-icon">{f.icon}</span>
              <div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
