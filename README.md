# Location Based Authentication


## TODO:

### 1. Connect to the database and send the payload:
- Uncomment the database logic in `routes/users.js`.
- Ensure the database connection is working correctly.
- Send the username and password from the login form to the database.
- Return a success message to the client.

### 2. Future Development:
- Implement JWT for session management.
- Explore OAuth for additional authentication features.
- Design the main application page, including a QR code scanner for the mobile version.
- Build the front-end registration page using React Native for the mobile application.
- Investigate and integrate the Google Location API.

### 3. React Native Camera Integration Plan:
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

**Note:** These tasks should be broken down into smaller, manageable steps.



