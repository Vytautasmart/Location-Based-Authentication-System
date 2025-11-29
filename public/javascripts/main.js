// This script runs after the HTML document has been fully loaded.
document.addEventListener("DOMContentLoaded", () => {
    // Get references to the HTML elements we need to interact with.
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const submitBtn = document.getElementById("submitBtn");

    // Add a click event listener to the submit button.
    submitBtn.addEventListener("click", () => {
        // Create a JavaScript object to hold the user's input.
        // Input: The values from the username and password input fields.
        const user = {
            username: usernameInput.value,
            password: passwordInput.value
        };

        // Use the fetch API to send the user data to the server.
        // Output: A POST request to the "/users" endpoint with the user data as a JSON string in the request body.
        fetch("/users", {
            method: "POST", // Specify the HTTP method.
            headers: {
                "Content-Type": "application/json" // Tell the server that we are sending JSON data.
            },
            body: JSON.stringify(user) // Convert the JavaScript object to a JSON string.
        })
        .then(response => response.json()) // Parse the JSON response from the server.
        .then(data => {
            // Log the success message from the server to the console.
            console.log("Success:", data);
            // Show a simple alert to the user.
            alert("User data sent to server. Check the server console.");
        })
        .catch((error) => {
            // Log any errors to the console.
            console.error("Error:", error);
            alert("Error sending user data. See the browser console for details.");
        });
    });
});
