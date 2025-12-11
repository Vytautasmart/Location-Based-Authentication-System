// This event listener ensures that the script runs only after the entire HTML document has been loaded.
document.addEventListener("DOMContentLoaded", () => {
    // Get references to the HTML elements from the registration form.
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const submitBtn = document.getElementById("submitBtn");
    const messageDiv = document.getElementById("message"); // The div for displaying feedback.

    // Attach a 'click' event listener to the registration button.
    submitBtn.addEventListener("click", () => {
        // Create a user object from the values in the input fields.
        const user = {
            username: usernameInput.value,
            password: passwordInput.value
        };

        // Use the Fetch API to send the new user data to the server's registration endpoint.
        fetch("/api/users", {
            method: "POST", // Use the POST method to create a new resource.
            headers: {
                // This header tells the server that the request body is in JSON format.
                "Content-Type": "application/json"
            },
            // Convert the JavaScript `user` object into a JSON string.
            body: JSON.stringify(user)
        })
        // When the server responds, parse the JSON body.
        .then(response => response.json())
        // This `.then()` block handles the data from the server's response.
        .then(data => {
            console.log("Success:", data); // Log the response for debugging.
            // The backend sends a `user` object on successful registration.
            if (data.user) {
                // Display a success message.
                messageDiv.textContent = "User registered successfully!";
                messageDiv.style.color = "green";
            } else {
                // If there's no `user` object, registration failed.
                // Display the error message sent from the backend (e.g., "Username already exists.").
                messageDiv.textContent = data.message || "An error occurred.";
                messageDiv.style.color = "red";
            }
        })
        // This `.catch()` block handles any network errors.
        .catch((error) => {
            console.error("Error:", error);
            messageDiv.textContent = "Error registering user. See console for details.";
            messageDiv.style.color = "red";
        });
    });
});
