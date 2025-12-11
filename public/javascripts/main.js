// This event listener ensures that the script runs only after the entire HTML document has been loaded and parsed.
document.addEventListener("DOMContentLoaded", () => {
  // Get references to the HTML elements we need to interact with from the login form.
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submitBtn");
  const messageDiv = document.getElementById("message"); // The div where we will display feedback to the user.

  // Attach a 'click' event listener to the login button.
  submitBtn.addEventListener("click", () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        const user = {
          username: usernameInput.value,
          password: passwordInput.value,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        // Use the Fetch API to send the user data to the server's login endpoint.
        fetch("/api/auth/access", {
          method: "POST", // We are sending data, so we use the POST method.
          headers: {
            // This header tells the server that the request body is in JSON format.
            "Content-Type": "application/json",
          },
          // Convert the JavaScript `user` object into a JSON string for transmission.
          body: JSON.stringify(user),
        })
          // When the server responds, parse the JSON body of the response.
          .then((response) => response.json())
          // This `.then()` block handles the data parsed from the successful server response.
          .then((data) => {
            console.log("Success:", data); // Log the server response for debugging.
            // Check if the server response contains a JWT token.
            if (data.token) {
              // If a token is present, the login was successful.
              messageDiv.textContent = "Logged in successfully!";
              messageDiv.style.color = "green";
              // As a next step, you could store the token and redirect the user.
              // For example:
              localStorage.setItem('token', data.token);
              window.location.href = '/dashboard.html';
            } else {
              // If there's no token, the login failed. Display the error message from the server.
              messageDiv.textContent = data.msg || "Login failed.";
              messageDiv.style.color = "red";
            }
          })
          // This `.catch()` block handles any network errors or issues with the fetch request itself.
          .catch((error) => {
            console.error("Error:", error);
            messageDiv.textContent = "Error logging in. See console for details.";
            messageDiv.style.color = "red";
          });
      }, error => {
        messageDiv.textContent = "Error getting location: " + error.message;
        messageDiv.style.color = "red";
      });
    } else {
      messageDiv.textContent = "Geolocation is not supported by this browser.";
      messageDiv.style.color = "red";
    }
  });
});
