# Location-Based Authentication System

This project is a Location-Based Authentication System. It is being built using JavaScript and Node.js for the backend. React Native will be utilized to create mobile applications for this system.

---

## Project Overview

> **Suggestion:** Describe the primary goal of your project here. What problem are you trying to solve? Who is this system for? For example: "This system is designed to provide a seamless and secure authentication experience for employees at a corporate campus by verifying their location, removing the need for traditional passwords when on-site."

## Core Features

> **Suggestion:** List the essential features. Be specific.
>
> - **User Registration & Login:** Standard email/password registration and a secure login mechanism.
> - **Location Verification:** The core feature. The mobile app will send the user's location to the backend for verification.
> - **Geofenced Zones:** Admins should be able to define geographical areas (geofences) where authentication is permitted.
> - **Real-time Access Control:** Grant or deny access to resources based on the user's real-time location.
> - **Admin Dashboard:** A web interface for administrators to manage users and geofenced zones.
> - **Security:** Encrypted data transmission (HTTPS), secure storage of user data, and protection against location spoofing.

## System Architecture

> **Suggestion:** Outline the main components of your system and how they interact.
>
> - **Frontend (Mobile):** React Native app for iOS and Android. Responsible for capturing GPS data and communicating with the backend.
> - **Backend:** Node.js with the Express.js framework to build a RESTful API.
> - **Database:** PostgreSQL for storing user data, location history, and geofence definitions.
> - **Real-time Communication (Optional):** WebSockets (e.g., using Socket.io) for real-time updates between the backend and mobile app.

## Data Models

> **Suggestion:** Define the structure of your database tables or document schemas.
>
> - **User:**
>   - `user_id` (Primary Key)
>   - `username` (String, unique)
>   - `email` (String, unique)
>   - `password_hash` (String)
>   - `created_at` (Timestamp)
> - **AuthZone (Geofence):**
>   - `zone_id` (Primary Key)
>   - `name` (String)
>   - `latitude` (Numeric)
>   - `longitude` (Numeric)
>   - `radius` (Numeric, in meters)
> - **LocationLog:**
>   - `log_id` (Primary Key)
>   - `user_id` (Foreign Key to User)
>   - `latitude` (Numeric)
>   - `longitude` (Numeric)
>   - `timestamp` (Timestamp)
>   - `is_within_zone` (Boolean)

## API Endpoints

> **Suggestion:** Plan the routes for your REST API.
>
> **Authentication:**
>
> - `POST /api/auth/register` - Register a new user.
> - `POST /api/auth/login` - Log in a user and return a token.
>
> **Location:**
>
> - `POST /api/location/verify` - Receive location data from the mobile app and verify if it's within an `AuthZone`.
>
> **Admin (Protected Routes):**
>
> - `GET /api/admin/zones` - Get all `AuthZone`s.
> - `POST /api/admin/zones` - Create a new `AuthZone`.
> - `PUT /api/admin/zones/:zone_id` - Update an `AuthZone`.
> - `DELETE /api/admin/zones/:zone_id` - Delete an `AuthZone`.

## Authentication Flow

> **Suggestion:** Describe the step-by-step logic for the location-based authentication.
>
> 1.  User opens the React Native mobile app and logs in. The app receives and stores an authentication token (e.g., JWT).
> 2.  The app requests the user's GPS coordinates from the device's location services.
> 3.  The app sends a `POST` request to the `/api/location/verify` endpoint, including the coordinates and the user's auth token in the header.
> 4.  The backend API receives the request, validates the token, and retrieves the allowed `AuthZone`(s) for that user.
> 5.  The backend calculates if the user's coordinates are within the radius of any of the allowed zones.
> 6.  The API returns a response to the app (e.g., `{ "access": "granted" }` or `{ "access": "denied" }`).
> 7.  The mobile app UI updates to show the user's access status.

## User Stories

> **Suggestion:** Write simple stories from the perspective of your users.
>
> - **As a regular user,** I want to open the mobile app on-site and be automatically granted access to secure company resources without needing to type a password.
> - **As a system administrator,** I want to be able to draw a new authentication zone on a map in the admin dashboard so I can quickly set up a new secure location.
> - **As a security officer,** I want to view a log of all location verification attempts to monitor for unusual activity.
