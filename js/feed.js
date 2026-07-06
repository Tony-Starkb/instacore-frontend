requireAuth();

const container = document.getElementById("feed-container");
const errorBanner = document.getElementById("error-banner");

function initials(username) {
  return (username || "?").slice(0, 2).toUpperCase();
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderPost(post, likedSet) {
  const isLiked = likedSet.has(post.id);
  return `
    <article class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <div class="post-avatar">${initials(post.username)}</div>
        <div>
          <div class="post-username">
            <a href="profile.html?username=${encodeURIComponent(post.username)}">${escapeHtml(post.username)}</a>
          </div>
          <div class="post-time">${timeAgo(post.created_at)}</div>
        </div>
      </div>
      <img class="post-image" src="${post.image_url}" alt="Post by ${escapeHtml(post.username)}" loading="lazy"
           onerror="this.style.display='none'" />
      <div class="post-body">
        <p class="post-caption">${escapeHtml(post.caption)}</p>
        <div class="post-actions">
          <button class="like-btn ${isLiked ? "liked" : ""}" data-liked="${isLiked}">
            <span class="like-icon">${isLiked ? "♥" : "♡"}</span>
            <span class="like-count">${post.like_count}</span>
          </button>
          <span class="comment-count">${post.comment_count} comments</span>
        </div>
      </div>
    </article>
  `;
}

async function toggleLike(postId, btn) {
  const isLiked = btn.dataset.liked === "true";
  const countEl = btn.querySelector(".like-count");
  const iconEl = btn.querySelector(".like-icon");
  let count = parseInt(countEl.textContent, 10);

  btn.disabled = true;
  try {
    if (!isLiked) {
      const data = await apiRequest(`/api/v1/posts/${postId}/like`, { method: "POST" });
      markPostLiked(postId);
      count = data.post.like_count;
      btn.dataset.liked = "true";
      btn.classList.add("liked");
      iconEl.textContent = "♥";
    } else {
      await apiRequest(`/api/v1/posts/${postId}/like`, { method: "DELETE" });
      markPostUnliked(postId);
      count = Math.max(0, count - 1);
      btn.dataset.liked = "false";
      btn.classList.remove("liked");
      iconEl.textContent = "♡";
    }
    countEl.textContent = count;
  } catch (err) {
    // Self-heal if our local "liked" tracking drifted from server truth.
    if (err.status === 409) {
      if (!isLiked) {
        markPostLiked(postId);
        btn.dataset.liked = "true";
        btn.classList.add("liked");
        iconEl.textContent = "♥";
      } else {
        markPostUnliked(postId);
        btn.dataset.liked = "false";
        btn.classList.remove("liked");
        iconEl.textContent = "♡";
      }
    } else {
      errorBanner.textContent = err.message;
      errorBanner.classList.add("visible");
    }
  } finally {
    btn.disabled = false;
  }
}

async function loadFeed() {
  try {
    const posts = await apiRequest("/api/v1/posts");
    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No posts yet</h3>
          <p>Be the first to <a href="create-post.html" style="color: var(--accent-2)">share something</a>.</p>
        </div>
      `;
      return;
    }

    const likedSet = getLikedPosts();
    // newest first
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    container.innerHTML = posts.map((p) => renderPost(p, likedSet)).join("");

    container.querySelectorAll(".like-btn").forEach((btn) => {
      const postId = btn.closest(".post-card").dataset.postId;
      btn.addEventListener("click", () => toggleLike(postId, btn));
    });
  } catch (err) {
    container.innerHTML = "";
    errorBanner.textContent = err.message;
    errorBanner.classList.add("visible");
  }
}

loadFeed();
