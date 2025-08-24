// login.js

// Replace with your Apps Script Web App URL (deployed as "Anyone with link")
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbyxK_6TXgTYtW2XFCE7zLlS232nD0GVK31hfGNYZPF777GLvZ9VU08xLSWthtqGLq13/exechttps://script.google.com/macros/s/AKfycbyxK_6TXgTYtW2XFCE7zLlS232nD0GVK31hfGNYZPF777GLvZ9VU08xLSWthtqGLq13/exec";

// This function is called when Google One Tap or Sign-In button succeeds
function handleCredentialResponse(response) {
  const idToken = response.credential;

  // Save token to localStorage so all pages can use it
  localStorage.setItem("id_token", idToken);

  // Verify with backend (optional check)
  fetch(BACKEND_URL + "?action=AUTH_ME", {
    method: "GET",
    headers: {
      "Authorization": "Bearer " + idToken,
      "Content-Type": "application/json"
    }
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        console.log("Login success:", data.user);
        alert("Welcome " + data.user.name);

        // Redirect based on role
        getUserRole(data.user.email);
      } else {
        alert("Login failed: " + data.error);
      }
    })
    .catch(err => {
      console.error("Error:", err);
      alert("Something went wrong during login");
    });
}

// Get user role from backend
function getUserRole(email) {
  fetch(BACKEND_URL + "?action=getUserRole&email=" + encodeURIComponent(email))
    .then(r => r.json())
    .then(data => {
      if (data.status === "success") {
        if (data.role === "Admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "user.html";
        }
      } else {
        alert("No role assigned, contact admin.");
      }
    });
}
