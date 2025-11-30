// This script runs after the HTML document has been fully loaded.
document.addEventListener("DOMContentLoaded", () => {
    // Get references to the HTML elements we need to interact with.
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const submitBtn = document.getElementById("submitBtn");
    const messageDiv = document.getElementById("message");

    // Add a click event listener to the submit button.
    submitBtn.addEventListener("click", () => {
        // Create a JavaScript object to hold the user's input.
        const user = {
            username: usernameInput.value,
            password: passwordInput.value
        };

        // Use the fetch API to send the user data to the server.
        fetch("/users", {
            method: "POST", // Specify the HTTP method.
            headers: {
                "Content-Type": "application/json" // Tell the server that we are sending JSON data.
            },
            body: JSON.stringify(user) // Convert the JavaScript object to a JSON string.
        })
        .then(response => response.json()) // Parse the JSON response from the server.
        .then(data => {
            console.log("Success:", data);
            if (data.user) {
                messageDiv.textContent = "User registered successfully!";
                messageDiv.style.color = "green";
            } else {
                messageDiv.textContent = data.message || "An error occurred.";
                messageDiv.style.color = "red";
            }
        })
        .catch((error) => {
            console.error("Error:", error);
            messageDiv.textContent = "Error registering user. See console for details.";
            messageDiv.style.color = "red";
        });
    });
});
