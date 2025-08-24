/**
 * js/api.js
 * Centralized API helper to communicate with Apps Script.
 * Set APPS_SCRIPT_ENDPOINT to your deployed Apps Script web app URL.
 */

const APPS_SCRIPT_ENDPOINT = "https://script.google.com/macros/s/AKfycbyxK_6TXgTYtW2XFCE7zLlS232nD0GVK31hfGNYZPF777GLvZ9VU08xLSWthtqGLq13/exec";

const API = (function(){
  function getAuthToken(){
    return localStorage.getItem("session_token");
  }
  function setAuthToken(token){
    if(token) localStorage.setItem("session_token", token);
    else localStorage.removeItem("session_token");
  }
  async function call(action, payload={}, method="POST"){
    const url = (method==="GET") ? APPS_SCRIPT_ENDPOINT + "?action=" + encodeURIComponent(action) : APPS_SCRIPT_ENDPOINT;
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken();
    if(token) headers["Authorization"] = "Bearer " + token;
    let options = { method: method, headers: headers, muteHttpExceptions:true };
    if(method !== "GET") {
      const body = Object.assign({}, payload, { action: action });
      options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const text = await res.text();
    try { return JSON.parse(text); } catch(e){ return { ok:false, error:"Invalid JSON from API", raw:text }; }
  }
  return { call, getAuthToken, setAuthToken };
})();
