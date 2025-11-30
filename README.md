# Location-Based Authentication System

## Project Description

The primary objective of this project is to design and implement a prototype of the Location-based Authentication System (LBAS). The system will be developed on both web and mobile platforms, utilising the following key technologies and components:

- GPS and Wi-Fi Location Services: To collect real-time location data from users' devices.
- Backend Authentication Server: A server to handle authentication requests, verify credentials, and check location data against predefined trusted zones.
- Database: Storing user credentials, authorised locations, and session logs.
- Communication Protocols: Secure communication between the client and server using HTTPS and data encryption.

The system will work by collecting the user's current location during login attempts and comparing it to trusted locations stored in the database. Only if the user is within an authorised zone will they be granted access to the system. This project also involves investigating the accuracy of location services and building safeguards against location spoofing attempts (e.g., through IP manipulation or GPS apps, consider location on campus?). The system will be evaluated based on the accuracy of location detection, speed of verification, and overall user experience.

## Deliverables

- **Working Prototype:** A functional LBAS prototype for both web and/or mobile platforms, capable of verifying user location and credentials.
- **Location-based Authentication Algorithm:** A robust algorithm that integrates user credentials and geographic location to grant or deny access.
- **Secure Communication Protocol:** Implementation of HTTPS and encryption methods to ensure secure data transmission between the client and the server.
- **System Evaluation:** A detailed report assessing the performance of the LBAS, including accuracy of location services, system latency, and user privacy considerations.
- **Demonstration Scenarios:** Real-world use cases demonstrating successful and unsuccessful login attempts based on the user's location, including geofencing, trusted locations, and security against location spoofing.
- **Dissertation etc..**

---

## Development TODO

The items below were part of the initial plan. Many have been completed or are in progress. The new plan for React Native is the main focus for future development.

### 1. Initial Setup (Largely Completed)
- Connect to the database and send the payload.
- Ensure the database connection is working correctly.
- Send the username and password from the login form to the database.
- Return a success message to the client.

### 2. Future Development (In Progress / Next Steps)
- Implement JWT for session management. *(Completed)*
- Explore OAuth for additional authentication features.
- Design the main application page, including a QR code scanner for the mobile version.
- Build the front-end registration page using React Native for the mobile application.
- Investigate and integrate the Google Location API.

### 3. React Native Camera Integration Plan
- **Environment Setup:**
  - Initialize a new React Native project within the repository (e.g., in a `/mobile` directory).
  - Ensure the development environment is configured for both iOS and Android as per the React Native documentation.
- **Camera Library Integration:**
  - Research and choose a camera library (e.g., `react-native-vision-camera` for performance or the community-supported `react-native-camera`).
  - Install and link the chosen library according to its installation instructions.
- **Permissions Handling:**
  - Implement logic to request camera permissions from the user on both iOS and Android.
  - Add necessary permission descriptions to `Info.plist` (for iOS) and `AndroidManifest.xml` (for Android).
- **Camera Component:**
  - Create a new React Native component to render the live camera view.
  - Add a button or touchable overlay to trigger photo capture.
- **Image Handling:**
  - Implement a function to handle the captured image data.
  - For now, display the captured image on the screen as a preview to confirm functionality.
  - (Future) Plan how the captured image will be used (e.g., sending to the server, processing for QR codes, etc.).

### 4. Location Authorization Plan
- **Database Schema Update:**
  - Create a new table, `auth_zones`, to store geofence data.
  - The table should include columns like `zone_id`, `name`, `latitude`, `longitude`, and `radius_meters`.
  - Consider adding a joining table to link users to specific zones if access is not global.

- **Backend API for Geofence Management:**
  - Create a new route file (e.g., `routes/zones.js`) for managing authentication zones.
  - Implement secure API endpoints for administrators to perform CRUD (Create, Read, Update, Delete) operations on the `auth_zones` table.
  - These endpoints will allow an admin to define, view, and modify the trusted geographical areas.

- **Core Location Verification Logic:**
  - Create a new API endpoint, for example `POST /api/auth/verify-location`.
  - This endpoint will receive the user's current `latitude` and `longitude` from the mobile client.
  - The backend will fetch the authorized zones for that user from the database.
  - Implement a geospatial calculation (e.g., the Haversine formula) to determine if the user's coordinates fall within the radius of any of the authorized zones.
  - The API will return a success or failure response based on this calculation (e.g., `{ "access": "granted" }` or `{ "access": "denied" }`).

- **React Native Client Integration:**
  - Integrate a geolocation library into the React Native project (e.g., `react-native-geolocation-service`).
  - Implement logic to request location permissions from the user.
  - On the login screen or a dedicated "authenticate" screen, fetch the user's current GPS coordinates.
  - Send these coordinates to the `POST /api/auth/verify-location` endpoint on the backend and handle the response to grant or deny access within the app.