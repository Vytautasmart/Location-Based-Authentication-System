# Location-Based Authentication System

Subject Area and Background:

This project is situated within the domain of cybersecurity and network authentication, focusing on the development of a Location-based Authentication System (LBAS). Traditional authentication methods, such as passwords or biometrics, rely on static factors, which can be susceptible to various attacks like phishing, brute force, and credential theft. To address these vulnerabilities, this project introduces a second layer of security by using a user's geographical location as part of the authentication process. LBAS leverages GPS or Wi-Fi-based location data to ensure that access to sensitive systems is granted only when a user is in a pre-approved location. This method adds an additional factor of authentication that enhances security, especially in systems where geographic location is an important determinant of access.

Project Description:

The primary objective of this project is to design and implement a prototype of the Location-based Authentication System (LBAS). The system will be developed on both web and mobile platforms, utilising the following key technologies and components:

- GPS and Wi-Fi Location Services: To collect real-time location data from users' devices.

- Backend Authentication Server: A server to handle authentication requests, verify credentials, and check location data against predefined trusted zones.

- Database: Storing user credentials, authorised locations, and session logs.

- Communication Protocols: Secure communication between the client and server using HTTPS and data encryption.

- The system will work by collecting the user's current location during login attempts and comparing it to trusted locations stored in the database. Only if the user is within an authorised zone will they be granted access to the system. This project also involves investigating the accuracy of location services and building safeguards against location spoofing attempts (e.g., through IP manipulation or GPS apps, consider location on campus?). The system will be evaluated based on the accuracy of location detection, speed of verification, and overall user experience.

Deliverables:

- Working Prototype: A functional LBAS prototype for both web and/or mobile platforms, capable of verifying user location and credentials.

- Location-based Authentication Algorithm: A robust algorithm that integrates user credentials and geographic location to grant or deny access.

- Secure Communication Protocol: Implementation of HTTPS and encryption methods to ensure secure data transmission between the client and the server.

- System Evaluation: A detailed report assessing the performance of the LBAS, including accuracy of location services, system latency, and user privacy considerations.

- Demonstration Scenarios: Real-world use cases demonstrating successful and unsuccessful login attempts based on the user's location, including geofencing, trusted locations, and security against location spoofing.

- Dissertation etc..
