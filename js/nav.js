// ---------------------------------------------------------------
// Renders the top nav bar into <div id="nav-placeholder"></div>
// Include this script + call renderNav() on every page.
// ---------------------------------------------------------------

function renderNav() {
  const el = document.getElementById("nav-placeholder");
  if (!el) return;

  const loggedIn = isLoggedIn();
  const username = getUsername();

  el.innerHTML = `
    <nav class="navbar">
      <a class="brand" href="feed.html">InstaCore</a>
      <div class="nav-links">
        ${
          loggedIn
            ? `
              <a href="feed.html">Home</a>
              <a href="create-post.html">Create</a>
              <a href="profile.html?username=${encodeURIComponent(username)}">Profile</a>
              <button class="nav-logout" id="logout-btn">Logout</button>
            `
            : `
              <a href="login.html">Log in</a>
              <a href="register.html" class="nav-cta">Sign up</a>
            `
        }
      </div>
    </nav>
  `;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "login.html";
    });
  }
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
  }
}

document.addEventListener("DOMContentLoaded", renderNav);
