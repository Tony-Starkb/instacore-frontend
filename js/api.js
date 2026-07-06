// ---------------------------------------------------------------
// InstaCore API layer
// Handles: token storage, auth headers, auto-refresh on 401,
// and turning the backend's error shape into readable messages.
// ---------------------------------------------------------------

const STORAGE_TOKEN_KEY = "instacore_access_token";
const STORAGE_USERNAME_KEY = "instacore_username";
const STORAGE_ROLE_KEY = "instacore_role";

class APIError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ---- session helpers ----

function getAccessToken() {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

function getUsername() {
  return localStorage.getItem(STORAGE_USERNAME_KEY);
}

function getRole() {
  return localStorage.getItem(STORAGE_ROLE_KEY);
}

function isLoggedIn() {
  return !!getAccessToken();
}

// Reads the payload of a JWT WITHOUT verifying it.
// Safe for display purposes only (username/role) - the backend
// always verifies the signature itself on every real request.
function decodeJWT(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function setSession(accessToken) {
  const claims = decodeJWT(accessToken);
  localStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
  if (claims) {
    localStorage.setItem(STORAGE_USERNAME_KEY, claims.username || "");
    localStorage.setItem(STORAGE_ROLE_KEY, claims.role || "user");
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USERNAME_KEY);
  localStorage.removeItem(STORAGE_ROLE_KEY);
}

// Liked-post tracking is client-side only (the API doesn't tell us
// per-user like state), scoped per logged-in username.
function likedPostsKey() {
  return `instacore_liked_${getUsername() || "anon"}`;
}

function getLikedPosts() {
  try {
    return new Set(JSON.parse(localStorage.getItem(likedPostsKey())) || []);
  } catch (e) {
    return new Set();
  }
}

function saveLikedPosts(set) {
  localStorage.setItem(likedPostsKey(), JSON.stringify(Array.from(set)));
}

function markPostLiked(postId) {
  const s = getLikedPosts();
  s.add(postId);
  saveLikedPosts(s);
}

function markPostUnliked(postId) {
  const s = getLikedPosts();
  s.delete(postId);
  saveLikedPosts(s);
}

// ---- core request function ----

async function refreshAccessToken() {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    throw new APIError("Session expired. Please log in again.", res.status);
  }
  const data = await res.json();
  setSession(data.access_token);
  return data.access_token;
}

/**
 * options:
 *   method: "GET" | "POST" | "PATCH" | "DELETE"
 *   json: object -> sent as JSON body
 *   form: object  -> sent as x-www-form-urlencoded body (used only for login)
 *   auth: boolean -> attach Authorization header (default true)
 */
async function apiRequest(path, options = {}) {
  const { method = "GET", json, form, auth = true } = options;

  async function doFetch(accessToken) {
    const headers = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    let body;
    if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    } else if (form !== undefined) {
      body = new URLSearchParams(form);
    }

    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body,
      credentials: "include",
    });
  }

  let res = await doFetch(auth ? getAccessToken() : null);

  // Access token expired mid-session -> try one silent refresh, then retry.
  if (res.status === 401 && auth && getAccessToken()) {
    try {
      const newToken = await refreshAccessToken();
      res = await doFetch(newToken);
    } catch (e) {
      clearSession();
      window.location.href = "login.html";
      throw new APIError("Session expired. Please log in again.", 401);
    }
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no body
  }

  if (!res.ok) {
    const message =
      (data && data.error && data.error.message) ||
      (data && data.detail) ||
      `Request failed (${res.status})`;
    throw new APIError(message, res.status);
  }

  return data;
}
