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

## Mobile Client Strategy

To achieve location-based authentication, a mobile device is required to provide GPS coordinates. Below are two distinct strategies for implementing this mobile component.

---

### Option 1: Native Mobile App (React Native)

This approach involves building a full, installable mobile application for iOS and Android.

#### Implementation Plan
1.  **Environment Setup:** Initialize a React Native project and configure the development environment for iOS and Android.
2.  **Library Integration:** Integrate native libraries for key functionalities:
    - **Geolocation:** Use a library like `react-native-geolocation-service` to access the device's GPS.
    - **Camera:** (If QR code scanning is desired from within the app) Use a library like `react-native-vision-camera` to access the camera.
3.  **Permissions Handling:** Implement logic to request Camera and Location permissions on both platforms, updating `Info.plist` (iOS) and `AndroidManifest.xml` (Android) accordingly.
4.  **UI/UX Development:** Build the application's user interface, including login screens, a home/dashboard screen, and the UI for location verification.
5.  **API Communication:** Integrate with the backend to log in users and send GPS coordinates to the location verification endpoint.

#### Benefits
- **Most Seamless User Experience:** Provides a smooth, integrated experience without leaving the app.
- **Deeper Native Integration:** Better and more reliable access to device APIs like location and camera.
- **Advanced Features:** Enables future capabilities like push notifications, background location checks, or offline functionality.
- **App Store Presence:** Can be published to the Apple App Store and Google Play Store.

#### Drawbacks
- **High Development Overhead:** Requires significant effort to build, test, and maintain a separate codebase for a mobile app.
- **Complex Deployments:** The process of submitting to and getting approved by app stores is complex and time-consuming.
- **User Friction:** Requires users to find, download, and install an application from an app store.

---

### Option 2: QR Code to Web-Based Verification

This approach avoids a full mobile app by using a QR code on the desktop web app to initiate a location check on the user's mobile browser.

#### Implementation Plan
1.  **Backend: Session Token Generation:** When a user logs in on desktop, generate a unique, short-lived session token and store it.
2.  **Frontend: QR Code Display:** On the desktop web app, display a QR code that contains a secure URL with the session token (e.g., `https://your-app.com/verify?token=abc123`).
3.  **Mobile Web Page:** Create a simple, mobile-friendly HTML page at the `/verify` URL. This page must be served over **HTTPS**.
    - The page will have a single "Verify My Location" button.
4.  **Frontend: Geolocation Request:** When the user taps the button, use the browser's Geolocation API to request their GPS coordinates. This will trigger a permission prompt from the browser.
5.  **Backend: Location Verification:**
    - The mobile web page sends the token and the GPS coordinates to a new backend endpoint (e.g., `POST /api/auth/verify-web-location`).
    - The backend validates the token, checks the location against the authorized geofences, and marks the desktop session as "verified."
6.  **Real-time Update (Polling or WebSockets):** The original desktop web app must be updated in real-time.
    - **Option A (Polling):** The desktop page repeatedly asks the backend, "Has my session been verified yet?"
    - **Option B (WebSockets):** Establish a WebSocket connection between the desktop and the server for instant, real-time communication once the location is verified.

#### Benefits
- **Drastically Lower Development Cost:** Avoids native app development entirely, relying on simple web technologies.
- **No Installation Required:** Users do not need to download anything; they can use their phone's standard camera and browser.
- **Faster to Prototype:** A functional proof-of-concept can be built very quickly.

#### Drawbacks
- **Less Seamless User Experience:** The user journey is more complex (scan -> open browser -> tap button -> grant permission).
- **HTTPS is a Hard Requirement:** The browser's Geolocation API will not work on insecure (HTTP) pages.
- **Requires Real-time Communication:** Adds the complexity of implementing WebSockets or polling to sync the desktop and mobile sessions.
- **Limited Functionality:** This approach cannot support more advanced features like push notifications or background tasks.

---

## Project Status

### Current Functionality

The application currently has the following features:

*   **User Authentication:** Users can register and log in with a username and password. User credentials are securely stored in a PostgreSQL database with hashed passwords.
*   **JWT-based API Authentication:** The API uses JSON Web Tokens (JWTs) for authenticating requests.
*   **Location-Based Access Control:** The application can now grant or deny access based on a user's geographical location.
*   **Authorized Zones:** The system supports the creation of authorized zones with a name, latitude, longitude, and radius. These zones are stored in the database.
*   **Location Verification:** The `locationService` uses the Haversine formula to determine if a user's location is within an authorized zone.
*   **API Endpoints:**
    *   `POST /api/auth/login`: Authenticates a user and returns a JWT.
    *   `POST /api/auth/access`: Orchestrates the full authentication and location verification process.
    *   `POST /api/zones`: Creates a new authorized zone.
    *   `POST /users`: Registers a new user.
    *   `/`: Serves the login page.
    *   `/register`: Serves the registration page.

### Testing

The following tests were performed to verify the functionality:

1.  **Database Migration:** A migration script was created and executed to add the `authorized_zones` table to the database.
2.  **Authorized Zone Creation:** A new authorized zone was successfully created using the `/api/zones` endpoint. The zone was created for the University of Greenwich with a 500-meter radius.
3.  **Location-Based Access Control:** The `/api/auth/access` endpoint was tested with two scenarios:
    *   **Inside the authorized zone:** A request was sent with the coordinates of the University of Greenwich. The access was correctly **granted**.
    *   **Outside the authorized zone:** A request was sent with the coordinates of the London Eye. The access was correctly **denied**.
4.  **Troubleshooting:**
    *   **Asynchronous Test Execution:** The initial tests appeared to fail due to the asynchronous nature of the test scripts. The test scripts were updated to use `async/await` to ensure the tests were executed in the correct order.
    *   **Server Process Management:** The server process was manually restarted to ensure the latest code changes were loaded.

### TODO List

*   [ ] Implement update and delete functionality for authorized zones in `/api/zones`.
*   [ ] Add authentication middleware to `/api/zones` to secure zone management endpoints.
*   [ ] Consider safeguards against location spoofing attempts (e.g., through IP manipulation or GPS apps).
*   [ ] Implement a join table to associate users with authorized zones for more granular control.
*   [ ] Enhance the frontend to provide a user interface for managing authorized zones.
*   [ ] Implement the mobile client strategy (either as a native app or a web-based verification flow).
*   [ ] Create a dedicated page where users can input location coordinates to test the authorization logic.
