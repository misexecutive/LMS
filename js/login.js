// ===== CONFIG =====
const OAUTH_CLIENT_ID = "616810582188-9hj0llh52sdbrh8o25bpnh9hldhtn68j.apps.googleusercontent.com";
const API_BASE = "https://script.google.com/macros/s/AKfycbzC6TbUeKjV8JMrHp4PI0EcPmDKU0Gjwr-GR-L8MshSEPTnCYNlscIOWkT2JlaUicJ1/exec"; // e.g. https://script.google.com/macros/s/XXX/exec

// ===== Init Google Login =====
window.onload = function () {
  google.accounts.id.initialize({
    client_id: OAUTH_CLIENT_ID,
    callback: handleCredentialResponse
  });

  google.accounts.id.renderButton(
    document.getElementById("buttonDiv"),
    { theme: "outline", size: "large" }
  );
};

// ===== Handle Login Response =====
async function handleCredentialResponse(response) {
  if (!response.credential) {
    document.getElementById("status").innerText = "Login failed.";
    return;
  }

  try {
    // Decode JWT to get email
    const payload = JSON.parse(atob(response.credential.split(".")[1]));
    const email = payload.email;

    // Save in sessionStorage
    sessionStorage.setItem("userEmail", email);

    // Check role from backend
    const roleRes = await fetch(`${API_BASE}?action=getUserRole&email=${encodeURIComponent(email)}`);
    const result = await roleRes.json();

    if (result.status === "success") {
      sessionStorage.setItem("userRole", result.role);

      if (result.role === "Admin") {
        window.location.href = "admin.html";
      } else if (result.role === "User") {
        window.location.href = "performance.html";
      } else {
        document.getElementById("status").innerText = "No role assigned. Contact Admin.";
      }
    } else {
      document.getElementById("status").innerText = "Access denied.";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "Error during login. See console.";
  }
}
