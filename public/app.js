window.currentUser = null;
window.isAdmin = false;

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  el.loginError = document.getElementById("loginError");
  el.loginStrip = document.getElementById("loginStrip");
  el.currentUsernameLabel = document.getElementById("currentUsernameLabel");
  el.settingsLink = document.getElementById("settingsLink");
  el.settingsDropdown = document.getElementById("settingsDropdown");
  el.logoutLink = document.getElementById("logoutLink");
  el.updateSettingsForm = document.getElementById("updateSettingsForm");
  el.feed = document.getElementById("feed");
  el.adminPanel = document.getElementById("adminPanel");
  el.pendingUsersList = document.getElementById("pendingUsersList");
  el.createPostButton = document.getElementById("createPostButton");
  el.composer = document.getElementById("composer");
  el.createColumn = document.getElementById("createColumn");
  el.mainGrid = document.getElementById("mainGrid");
  el.heroGrid = document.getElementById("heroGrid");

  el.settingsLink.addEventListener("click", () => {
    el.settingsDropdown.classList.toggle("hidden");
  });

  el.logoutLink.addEventListener("click", logout);
  el.updateSettingsForm.addEventListener("submit", updateSettings);
  el.createPostButton.addEventListener("click", createPost);

  loadPosts();
});

function onAuthenticated() {
  el.loginError.textContent = "";
  el.loginStrip.classList.add("hidden");
  el.currentUsernameLabel.textContent = window.currentUser || "";
  el.currentUsernameLabel.classList.remove("hidden");
  el.settingsLink.classList.remove("hidden");
  el.logoutLink.classList.remove("hidden");
  el.composer.classList.remove("hidden");
  el.createColumn.classList.remove("hidden");
  el.mainGrid.classList.add("authenticated");
  el.heroGrid.classList.add("authenticated");
}

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      el.loginError.innerText = data.error || "Login failed";
      return;
    }

    window.currentUser = data.username;
    window.isAdmin = Boolean(data.isAdmin);

    onAuthenticated();

    if (window.isAdmin) {
      el.adminPanel.classList.remove("hidden");
      await loadPendingUsers();
    }

    await loadPosts();
  } catch (err) {
    console.error("Login error:", err);
    el.loginError.innerText = "Server error";
  }
}

async function updateSettings(event) {
  event.preventDefault();

  const currentPassword = document.getElementById("currentPassword").value;
  const newUsername = document.getElementById("newUsername").value.trim();
  const newPassword = document.getElementById("newPassword").value;

  try {
    const res = await fetch("/updateSettings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newUsername, newPassword }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Settings updated!");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newUsername").value = "";
      document.getElementById("newPassword").value = "";

      if (newUsername) {
        window.currentUser = newUsername;
        el.currentUsernameLabel.textContent = window.currentUser;
      }

      return;
    }

    alert(`Error: ${data.error || "Unknown"}`);
  } catch (err) {
    console.error(err);
    alert("Server error updating settings");
  }
}

async function logout() {
  try {
    const res = await fetch("/logout", { method: "POST" });
    if (res.ok) {
      location.reload();
    }
  } catch (err) {
    console.error("Logout error:", err);
  }
}

async function loadPendingUsers() {
  try {
    const res = await fetch("/pendingUsers");
    const data = await res.json();
    if (!data.success) return;

    el.pendingUsersList.innerHTML = "";

    data.users.forEach((user) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.innerText = "Approve";
      button.addEventListener("click", () => approveUser(user.id));
      li.innerText = `${user.username} `;
      li.appendChild(button);
      el.pendingUsersList.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading pending users:", err);
  }
}

async function approveUser(userId) {
  try {
    const res = await fetch(`/approveUser/${userId}`, { method: "POST" });
    if (res.ok) {
      loadPendingUsers();
    }
  } catch (err) {
    console.error("Error approving user:", err);
  }
}

async function createPost() {
  if (!window.currentUser) {
    alert("Please login first.");
    return;
  }

  const subjectPostElement = document.getElementById("subjectPost");
  const textPostElement = document.getElementById("textPost");
  const mediaInputElement = document.getElementById("mediaInput");

  const subject = subjectPostElement.value.trim();
  const text = textPostElement.value.trim();
  const file = mediaInputElement.files[0];

  if (!text && !file) {
    alert("Please add text or upload media first.");
    return;
  }

  const formData = new FormData();
  formData.append("subject", subject);
  formData.append("text", text);
  if (file) formData.append("media", file);

  try {
    const res = await fetch("/post", { method: "POST", body: formData });
    if (!res.ok) {
      throw new Error("Failed to create post");
    }

    subjectPostElement.value = "";
    textPostElement.value = "";
    mediaInputElement.value = "";
    loadPosts();
  } catch (err) {
    console.error("Post error:", err);
    alert("Unable to post right now.");
  }
}

async function submitComment(postId, comment) {
  try {
    const res = await fetch("/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, comment, username: window.currentUser }),
    });

    if (res.ok) {
      loadPosts();
    }
  } catch (err) {
    console.error("Comment submit error:", err);
  }
}

async function loadPosts() {
  if (!el.feed) return;

  try {
    const res = await fetch("/posts");
    if (!res.ok) {
      throw new Error("Failed to load posts");
    }

    const data = await res.json();
    const posts = data.posts || [];
    const comments = data.comments || [];

    el.feed.innerHTML = "";

    posts.forEach((post) => {
      const card = document.createElement("article");
      card.className = "post-card";

      const relatedComments = comments.filter((comment) => comment.post_id === post.id);
      const media = renderMedia(post.media, post.text);
      const safeText = escapeHtml(post.text || "");
      const safeTitle = escapeHtml(getPostTitle(post.subject, post.text));

      card.innerHTML = `
        <div class="media-slot">${media}</div>
        <div class="post-main">
          <div class="post-meta">${escapeHtml(post.username)}<br>(${new Date(post.timestamp).toLocaleString()})</div>
          <h3 class="post-title">${safeTitle}</h3>
          <p class="post-body">${safeText}</p>
          <div class="post-comments-area">
            <div class="comments">
              ${relatedComments
                .map(
                  (comment) =>
                    `<p class="comment"><strong>${escapeHtml(comment.username)}:</strong> ${escapeHtml(comment.comment)}</p>`,
                )
                .join("")}
            </div>
            <div class="comment-input">
              <label>Comment:</label>
              <input type="text" placeholder="Comment">
              <button type="button">Send</button>
            </div>
          </div>
        </div>
      `;

      const input = card.querySelector(".comment-input input");
      const button = card.querySelector(".comment-input button");

      button.addEventListener("click", () => {
        const value = input.value.trim();
        if (!value) return;
        submitComment(post.id, value);
        input.value = "";
      });

      el.feed.appendChild(card);
    });
  } catch (err) {
    console.error("Load posts error:", err);
  }
}

function renderMedia(filename, text) {
  if (!filename) {
    const caption = text && text.trim() ? 'This post is text based →' : 'No media attached';
    return `<p class="text-only-indicator">${escapeHtml(caption)}</p>`;
  }

  const source = `/uploads/${filename}`;
  const lower = filename.toLowerCase();

  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
    return `<video class="post-media" controls src="${source}"></video>`;
  }

  return `<img class="post-media" src="${source}" alt="Post media">`;
}

function getPostTitle(subject, text) {
  const normalizedSubject = (subject || "").trim();
  if (normalizedSubject) return normalizedSubject;

  if ((text || "").trim()) return "I wanted you to see this<3";

  return "I wanted you to see this<3";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}