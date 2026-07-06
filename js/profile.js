requireAuth();

const container = document.getElementById("profile-container");
const errorBanner = document.getElementById("error-banner");

const params = new URLSearchParams(window.location.search);
const targetUsername = params.get("username") || getUsername();
const viewingOwnProfile = targetUsername === getUsername();

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderPostGrid(posts) {
  if (!posts || posts.length === 0) {
    return `<div class="empty-state">No posts yet.</div>`;
  }
  return `
    <div class="post-grid">
      ${posts
        .map(
          (p) => `
        <div class="post-grid-item" title="${escapeHtml(p.caption)}">
          <img src="${p.image_url}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'" />
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

async function checkIsFollowing(username) {
  try {
    const data = await apiRequest(`/api/v1/users/${encodeURIComponent(username)}/followers`);
    return (data.users || []).includes(getUsername());
  } catch (e) {
    return false;
  }
}

async function handleFollowToggle(username, btn) {
  const following = btn.dataset.following === "true";
  btn.disabled = true;
  try {
    if (following) {
      await apiRequest(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" });
      btn.dataset.following = "false";
      btn.textContent = "Follow";
      btn.classList.remove("following");
    } else {
      await apiRequest(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: "POST" });
      btn.dataset.following = "true";
      btn.textContent = "Following";
      btn.classList.add("following");
    }
  } catch (err) {
    errorBanner.textContent = err.message;
    errorBanner.classList.add("visible");
  } finally {
    btn.disabled = false;
  }
}

async function loadProfile() {
  try {
    const [user, posts] = await Promise.all([
      apiRequest(`/api/v1/users/${encodeURIComponent(targetUsername)}`),
      apiRequest(`/api/v1/users/${encodeURIComponent(targetUsername)}/posts`),
    ]);

    let followButtonHtml = "";
    if (!viewingOwnProfile) {
      const isFollowing = await checkIsFollowing(targetUsername);
      followButtonHtml = `
        <button class="follow-btn ${isFollowing ? "following" : ""}" id="follow-btn" data-following="${isFollowing}">
          ${isFollowing ? "Following" : "Follow"}
        </button>
      `;
    }

    const initials = (user.username || "?").slice(0, 2).toUpperCase();

    container.innerHTML = `
      <div class="profile-header">
        ${
          user.avatar_url
            ? `<img class="profile-avatar" src="${user.avatar_url}" alt="" onerror="this.outerHTML='<div class=\\'profile-avatar\\'>${initials}</div>'" />`
            : `<div class="profile-avatar">${initials}</div>`
        }
        <div>
          <div class="profile-username"><b>${escapeHtml(user.username)}</b></div>
          ${user.full_name ? `<div class="profile-fullname">${escapeHtml(user.full_name)}</div>` : ""}
          <div class="profile-stats">
            <div><b>${user.post_count}</b> <span>posts</span></div>
            <div><b>${user.follower_count}</b> <span>followers</span></div>
            <div><b>${user.following_count}</b> <span>following</span></div>
          </div>
          ${followButtonHtml}
        </div>
      </div>
      ${user.bio ? `<p class="profile-bio">${escapeHtml(user.bio)}</p>` : ""}
      ${renderPostGrid(posts)}
    `;

    const followBtn = document.getElementById("follow-btn");
    if (followBtn) {
      followBtn.addEventListener("click", () => handleFollowToggle(targetUsername, followBtn));
    }
  } catch (err) {
    container.innerHTML = "";
    errorBanner.textContent = err.message;
    errorBanner.classList.add("visible");
  }
}

loadProfile();
