document.addEventListener("DOMContentLoaded", () => {
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const submitBtn = document.getElementById("submitBtn");

    submitBtn.addEventListener("click", () => {
        const user = {
            username: usernameInput.value,
            password: passwordInput.value
        };

        fetch("/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(user)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Success:", data);
            alert("User data sent to server. Check the server console.");
        })
        .catch((error) => {
            console.error("Error:", error);
            alert("Error sending user data. See the browser console for details.");
        });
    });
});
