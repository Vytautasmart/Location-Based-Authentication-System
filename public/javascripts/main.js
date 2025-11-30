document.addEventListener("DOMContentLoaded", () => {
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const submitBtn = document.getElementById("submitBtn");
  const messageDiv = document.getElementById("message");

  submitBtn.addEventListener("click", () => {
    const user = {
      username: usernameInput.value,
      password: passwordInput.value,
    };

    fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(user),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Success:", data);
        if (data.token) {
          messageDiv.textContent = "Logged in successfully!";
          messageDiv.style.color = "green";
          // Optionally, store the token and redirect
          // localStorage.setItem('token', data.token);
          // window.location.href = '/dashboard';
        } else {
          messageDiv.textContent = data.msg || "Login failed.";
          messageDiv.style.color = "red";
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        messageDiv.textContent = "Error logging in. See console for details.";
        messageDiv.style.color = "red";
      });
  });
});
