# Location-Based Authentication System

## Project Description

The primary objective of this project is to design and implement a prototype of the Location-based Authentication System (LBAS). The system is a responsive web application that works across desktop and mobile browsers, utilising the following key technologies and components:

- GPS and Wi-Fi Location Services: To collect real-time location data from users' devices.
- Backend Authentication Server: A server to handle authentication requests, verify credentials, and check location data against predefined trusted zones.
- Database: Storing user credentials, authorised locations, and session logs.
- Communication Protocols: Secure communication between the client and server using HTTPS and data encryption.

The system will work by collecting the user's current location during login attempts and comparing it to trusted locations stored in the database. Only if the user is within an authorised zone will they be granted access to the system. This project also involves investigating the accuracy of location services and building safeguards against location spoofing attempts (e.g., through IP manipulation or GPS apps, consider location on campus?). The system will be evaluated based on the accuracy of location detection, speed of verification, and overall user experience.

## Deliverables

- **Working Prototype:** A functional LBAS prototype accessible via desktop and mobile browsers, capable of verifying user location and credentials.
- **Location-based Authentication Algorithm:** A robust algorithm that integrates user credentials and geographic location to grant or deny access.
- **Secure Communication Protocol:** Implementation of HTTPS and encryption methods to ensure secure data transmission between the client and the server.
- **System Evaluation:** A detailed report assessing the performance of the LBAS, including accuracy of location services, system latency, and user privacy considerations.
- **Demonstration Scenarios:** Real-world use cases demonstrating successful and unsuccessful login attempts based on the user's location, including geofencing, trusted locations, and security against location spoofing.
- **Dissertation etc..**

---

## Project Status

### Current Functionality

The application currently has the following features:

*   **User Authentication:** Users can register and log in with a username and password. Credentials are securely stored in PostgreSQL with bcrypt-hashed passwords and input validation (password complexity, alphanumeric usernames).
*   **Role-Based Access Control (RBAC):** Supports "admin" and "user" roles with middleware-enforced access control.
*   **JWT-based API Authentication:** Access tokens (15-min expiry, HS256) with refresh token rotation (7-day expiry). Refresh tokens are hashed and stored in the database, delivered via HTTPOnly secure cookies with SameSite=strict.
*   **Location-Based Access Control:** Grants or denies access based on the user's geographical location compared to authorized zones. Admin users bypass location checks.
*   **Authorized Zone Management (CRUD):** Full create, read, update, and delete operations for authorized zones. Only admin users can create, update, or delete zones.
*   **Location Spoofing Detection:** IP-based spoofing detection using multiple geolocation providers (ip-api.com, ipinfo.io). Detects VPN/proxy usage and flags distance anomalies (50km threshold) between reported GPS and IP-derived location.
*   **Location Verification:** The `locationService` uses the Haversine formula to determine if a user's location is within any authorized zone's radius.
*   **Audit Logging:** All authentication attempts are logged to the `auth_logs` table, capturing client coordinates, IP-derived coordinates, spoofing status, access decision, and verification latency.
*   **Security Hardening:** HTTPS with HSTS, Helmet.js security headers, Content Security Policy, CORS restrictions, rate limiting on auth endpoints (100 req/15 min), request body size limits (10KB), and timing-attack-safe credential checks.
*   **React Frontend:** Single-page application with:
    *   Login page with browser Geolocation API integration
    *   User registration page
    *   Dashboard with user profile, zone management, interactive Leaflet map, and authentication logs table
    *   Responsive navigation bar

*   **API Endpoints:**

    | Endpoint | Method | Auth | Description |
    |----------|--------|------|-------------|
    | `/api/auth/login` | POST | None | Authenticate user, return JWT |
    | `/api/auth/access` | POST | None | Full auth + location verification flow |
    | `/api/auth/refresh` | POST | Cookie | Refresh access token (token rotation) |
    | `/api/auth/logout` | POST | Cookie | Invalidate refresh token |
    | `/api/zones` | GET | None | List all authorized zones |
    | `/api/zones` | POST | JWT (admin) | Create a new authorized zone |
    | `/api/zones/:id` | PUT | JWT (admin) | Update an authorized zone |
    | `/api/zones/:id` | DELETE | JWT (admin) | Delete an authorized zone |
    | `/api/users` | POST | None | Register a new user |
    | `/api/users/me` | GET | JWT | Get authenticated user profile |

### Testing

A testing framework using **Jest** and **Supertest** has been set up to automate API testing. The following tests are implemented:

*   **Authentication & Access Control (11 tests):**
    *   Login with valid location — access granted, auth log recorded
    *   Login with invalid location — access denied (403)
    *   Login with spoofed location — access denied (403)
    *   Login with wrong credentials — rejected (401)
    *   Expired JWT token — correctly rejected (401)
    *   Protected route without token — denied (401)
    *   Malformed JWT token — denied (401)
    *   Token payload contains correct user data (id, role)
    *   Token refresh with valid refresh token — new token issued
    *   Logout — refresh token invalidated
*   **Zone Management (5 tests):**
    *   GET /api/zones returns all zones
    *   POST /api/zones denied without token (401)
    *   POST /api/zones denied for non-admin users (403)
    *   POST /api/zones creates zone for admin (200)
    *   POST /api/zones returns 400 for missing fields

### Spoofing Detection: Capabilities and Limitations

The system's location spoofing detection works by cross-referencing the client's self-reported GPS coordinates with their IP-derived geolocation. This section documents what it can and cannot detect.

**What it detects:**
*   **VPN/Proxy usage:** Detected via ip-api.com and ipinfo.io metadata flags. If the IP is identified as a VPN, proxy, or Tor exit node, access is denied immediately.
*   **IP-GPS distance anomalies:** If the distance between the IP-derived location and the client-reported GPS exceeds 50km, the request is flagged as spoofed. This catches cases where a user physically in one country reports coordinates in another.

**What it cannot detect:**
*   **GPS spoofing apps:** Software like "Fake GPS" on Android or jailbroken iOS devices modifies the GPS coordinates at the OS level. The browser Geolocation API returns the spoofed coordinates directly — there is no browser-level API to detect this manipulation.
*   **Local network spoofing:** If the user is on the same local network (same IP) as the authorized zone but using a GPS spoofer, the IP check will pass since the IP location matches the zone.
*   **Residential VPNs:** Some VPN services route traffic through residential IP addresses, which may not be flagged as proxies by geolocation providers.

**Potential future improvements:**
*   **Wi-Fi fingerprinting:** Comparing nearby Wi-Fi access points against known databases (e.g., Google's geolocation API) to get an independent location estimate.
*   **Device sensor analysis:** Checking accelerometer, gyroscope, and barometer data for patterns inconsistent with genuine movement.
*   **Temporal analysis:** Flagging impossible travel scenarios (e.g., login from London, then New York 10 minutes later).
*   **Browser environment checks:** Detecting developer tools, mock geolocation settings, or known spoofing extensions.

### TODO List

*   [x] Implement update and delete functionality for authorized zones in `/api/zones`.
*   [x] Enhance the frontend to provide a user interface for managing authorized zones.
*   [x] Implement a join table to associate users with authorized zones for more granular control.
*   [x] Create a dedicated page where users can input location coordinates to test the authorization logic.
