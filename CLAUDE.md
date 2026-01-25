# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install all dependencies (backend + frontend)
npm install && cd frontend && npm install && cd ..

# Development server (auto-reload with nodemon)
npm run devstart

# Production start
npm start

# Frontend only (Vite dev server on port 5173)
cd frontend && npm run dev

# Build frontend
npm run build-frontend

# Run tests (Jest + Supertest)
npm run test

# Lint frontend
cd frontend && npm run lint
```

## Architecture Overview

This is a Location-Based Authentication System (LBAS) - a full-stack app that grants/denies access based on user location combined with credential verification.

### Tech Stack
- **Backend**: Express.js 5, Passport.js (Local + JWT strategies), PostgreSQL, bcryptjs
- **Frontend**: React 19, Vite, React Router, Leaflet maps
- **Servers**: HTTPS on port 3443, HTTP on port 3000

### Core Flow
1. User submits credentials + GPS coordinates via `/api/auth/access`
2. `locationService.js` verifies location is within authorized zones (Haversine formula)
3. `locationService.js` performs IP-based spoofing detection (multi-source geolocation APIs)
4. `authorizationService.js` makes grant/deny decision; admin users bypass location checks
5. JWT issued on success (15-min expiry), refresh tokens stored in HTTPOnly cookies (7-day expiry)

### Key Directories
- `routes/` - API endpoints: auth.js (login/access/refresh/logout), zones.js (CRUD), users.js (register)
- `services/` - Business logic: locationService.js (geolocation), authorizationService.js (access decisions)
- `middleware/` - passport.js (auth strategies), rbac.js (role checking)
- `db/` - PostgreSQL connection (postgre.js) and migrations
- `frontend/src/` - React app with pages/ and components/

### Database Tables
- `users` - credentials + role (admin/user)
- `authorized_zones` - geofenced zones (name, lat, lng, radius)
- `auth_logs` - audit trail with location data, spoofing check results, latency
- `refresh_tokens` - token rotation with expiration

### API Endpoints
| Endpoint | Auth | Description |
|----------|------|-------------|
| POST /api/auth/login | None | Get JWT token |
| POST /api/auth/access | None | Login + location verification |
| POST /api/auth/refresh | Cookie | Refresh access token |
| POST /api/auth/logout | Cookie | Invalidate refresh token |
| GET /api/zones | None | List authorized zones |
| POST/PUT/DELETE /api/zones | JWT (admin) | Manage zones |
| POST /api/users | None | Register user |
| GET /api/users/me | JWT | Get user profile |

## Environment Variables

Required in `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your_secret_key
```
