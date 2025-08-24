/**
 * js/auth.js
 * Uses Google Identity Services (GIS) for one-tap / button flow.
 * On sign in, it posts id_token to Apps Script action=AUTH_LOGIN which returns session JWT.
 *
 * Add this script in login.html and include your OAUTH_CLIENT_ID in the data-client_id attribute.
 */

const AUTH = (function(){
  // initialize Google Identity
  function init(clientId, onSignedIn){
    window.googleAccountsInit = () => {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          // resp.credential is the ID token
          const idToken = resp.credential;
          // send to backend to validate & create session
          const body = { idToken: idToken };
          const r = await API.call("AUTH_LOGIN", body, "POST");
          if(r.ok){
            API.setAuthToken(r.token);
            onSignedIn && onSignedIn(r.profile);
          } else {
            alert("Login failed: " + (r.error || "Unknown"));
          }
        }
      });
      // Render a button if container exists
      const container = document.getElementById("g_id_onload") || null;
      if(container){
        google.accounts.id.renderButton(
          document.getElementById("buttonDiv"),
          { theme: "outline", size: "large" }
        );
        google.accounts.id.prompt(); // optional
      }
    };
  }

  async function signOut(){
    API.setAuthToken(null);
    // optionally call google.accounts.id.revoke if needed
  }

  return { init, signOut };
})();
