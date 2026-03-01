window.currentUser = null;
window.isAdmin = false;

// --- LOGIN ---
async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      document.getElementById("loginError").innerText = data.error || "Login failed";
      return;
    }

    window.currentUser = data.username;
    window.isAdmin = data.isAdmin;

    // Show main app
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    // Show admin panel if admin
    if (window.isAdmin) {
      document.getElementById("adminPanel").style.display = "block";
      loadPendingUsers();
    }

    window.addEventListener("DOMContentLoaded", () => {
    // Load posts immediately, even before login
    loadPosts();
});

    // Load feed and attach event listeners
    loadPosts();

  } catch (err) {
    console.error("Login error:", err);
    document.getElementById("loginError").innerText = "Server error";
  }
}

// --- REGISTER ---
async function registerUser() {
  const username = document.getElementById("registerUsername").value;
  const password = document.getElementById("registerPassword").value;

  if (!username || !password) {
    alert("Username and password required");
    return;
  }

  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    alert(data.message || data.error);

  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

// --- SETTINGS ---
const settingsLink = document.getElementById("settingsLink");
const settingsDropdown = document.getElementById("settingsDropdown");
settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
});

document.getElementById("updateSettingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById("currentPassword").value;
  const newUsername = document.getElementById("newUsername").value;
  const newPassword = document.getElementById("newPassword").value;

  try {
    const res = await fetch("/updateSettings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newUsername, newPassword })
    });

    if (data.success) {
      alert("Settings updated!");
      document.getElementById("currentPassword").value = "";
      document.getElementById("newUsername").value = "";
      document.getElementById("newPassword").value = "";
    } else {
      alert("Error: " + (data.error || "Unknown"));
    }
  } catch (err) {
    console.error(err);
    alert("Server error updating settings");
  }
});

// --- LOGOUT ---
async function logout() {
  try {
    const res = await fetch("/logout", { method: "POST" });
    if (res.ok) location.reload();
  } catch (err) {
    console.error("Logout error:", err);
  }
}

// --- ADMIN: PENDING USERS ---
async function loadPendingUsers() {
  try {
    const res = await fetch("/pendingUsers");
    if (!data.success) return;

    const container = document.getElementById("pendingUsersList");
    container.innerHTML = "";

    data.users.forEach(user => {
      const div = document.createElement("div");
      div.innerHTML = `
        ${user.username} <button onclick="approveUser(${user.id})">Approve</button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error loading pending users:", err);
  }
}

async function approveUser(userId) {
  try {
    const res = await fetch(`/approveUser/${userId}`, { method: "POST" });
    if (res.ok) loadPendingUsers();
  } catch (err) {
    console.error("Error approving user:", err);
  }
}

// --- POSTS ---
async function createPost() {
  const text = document.getElementById("textPost")?.value || "";
  const file = document.getElementById("mediaInput")?.files?.[0];

  const formData = new FormData();
  formData.append("text", text);
  if (file) formData.append("media", file);

  try {
    const res = await fetch("/post", { method: "POST", body: formData });
    if (res.ok) {
      document.getElementById("textPost").value = "";
      document.getElementById("mediaInput").value = "";
      loadPosts();
    }
  } catch (err) {
    console.error("Post error:", err);
  }
}

// --- COMMENTS ---
async function submitComment(postId, comment) {
  try {
    const res = await fetch("/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, comment, username: window.currentUser })
    });
    if (res.ok) loadPosts();
  } catch (err) {
    console.error("Comment submit error:", err);
  }
}

// --- LOAD POSTS ---
async function loadPosts() {
    const feed = document.getElementById("feed");
    if (!feed) return;

    try {
        const res = await fetch("/posts");
        if (!res.ok) throw new Error("Failed to load posts");

        const { posts, comments } = data;

        feed.innerHTML = "";

        posts.forEach(post => {
            const postComments = comments.filter(c => c.post_id === post.id);

            const postDiv = document.createElement("div");
            postDiv.className = "post";
            postDiv.innerHTML = `
                <h3>${post.username} (${new Date(post.timestamp).toLocaleString()})</h3>
                <p>${post.text}</p>
                ${post.media ? `<img src="/uploads/${post.media}" alt="Post media" class="post-media">` : ""}
                <div id="comments-${post.id}" class="comments">
                    ${postComments.map(c => `<p><strong>${c.username}:</strong> ${c.comment}</p>`).join("")}
                </div>
            `;

            // Only add comment input if user is logged in
            if (window.currentUser) {
                const commentSection = document.createElement("div");
                commentSection.innerHTML = `
                    <input type="text" id="comment-input-${post.id}" placeholder="Write a comment">
                    <button id="comment-btn-${post.id}">Send</button>
                `;
                postDiv.appendChild(commentSection);

                const commentBtn = postDiv.querySelector(`#comment-btn-${post.id}`);
                if (commentBtn) {
                    commentBtn.onclick = () => {
                        const input = postDiv.querySelector(`#comment-input-${post.id}`);
                        if (input && input.value.trim() !== "") {
                            submitComment(post.id, input.value.trim());
                            input.value = "";
                        }
                    };
                }
            }

            feed.appendChild(postDiv);
        });
    } catch (err) {
        console.error("Load posts error:", err);
    }
}