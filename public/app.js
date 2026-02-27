async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

       if (res.ok) {
    const data = await res.json();
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";

    window.currentUser = data.username;
    window.isAdmin = data.isAdmin;

    loadPosts();
} else {
            document.getElementById("loginError").innerText = "Login failed";
        }
    } catch (err) {
        console.error("Login error:", err);
    }
}

async function createPost() {
    const text = document.getElementById("textPost").value;
    const file = document.getElementById("mediaInput").files[0];

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

async function addComment(postId) {
    const commentText = document.getElementById("comment-" + postId).value;
    const name = document.getElementById("name-" + postId).value;

    if (!commentText) return;

    try {
        const res = await fetch("/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                postId,
                comment: commentText,
                username: name
            })
        });

        if (res.ok) loadPosts();
    } catch (err) {
        console.error("Comment error:", err);
    }
}
async function loadPosts() {
    try {
        const res = await fetch("/posts");
        const data = await res.json();
        const container = document.getElementById("posts");
        container.innerHTML = "";

        (data.posts || []).forEach(post => {

            let mediaHTML = "";

            if (post.media) {
                const file = post.media.toLowerCase();

                if (file.endsWith(".jpg") || file.endsWith(".jpeg") || file.endsWith(".png") || file.endsWith(".gif")) {
                    mediaHTML = `<img src="/uploads/${post.media}" style="max-width:300px"><br>`;
                } 
                else if (file.endsWith(".mp4") || file.endsWith(".webm")) {
                    mediaHTML = `
                        <video controls style="max-width:300px">
                            <source src="/uploads/${post.media}" type="video/mp4">
                        </video><br>
                    `;
                } 
                else if (file.endsWith(".mp3") || file.endsWith(".wav")) {
                    mediaHTML = `
                        <audio controls>
                            <source src="/uploads/${post.media}" type="audio/mpeg">
                        </audio><br>
                    `;
                }
            }

            let div = document.createElement("div");
            div.className = "post";
            div.innerHTML = `
                <b>${post.username}</b> (${new Date(post.timestamp).toLocaleString()})<br>
                ${post.text || ""}<br>
                ${mediaHTML}
            `;

            // Public comment inputs
            const nameInput = document.createElement("input");
            nameInput.placeholder = "Your name (optional)";
            nameInput.id = "name-" + post.id;

            const commentInput = document.createElement("input");
            commentInput.placeholder = "Add comment";
            commentInput.id = "comment-" + post.id;

            const commentButton = document.createElement("button");
            commentButton.innerText = "Comment";
            commentButton.onclick = () => addComment(post.id);

            div.appendChild(nameInput);
            div.appendChild(commentInput);
            div.appendChild(commentButton);

            // Comments
            (data.comments || [])
                .filter(c => c.post_id === post.id)
                .forEach(c => {

                    let comDiv = document.createElement("div");
                    comDiv.className = "comment";
                    comDiv.innerText = `${c.username}: ${c.comment}`;

                    if (window.isAdmin) {
                        const deleteBtn = document.createElement("button");
                        deleteBtn.innerText = "Delete";
                        deleteBtn.style.marginLeft = "10px";
                        deleteBtn.onclick = async () => {
                            await fetch(`/deleteComment/${c.id}`, { method: "DELETE" });
                            loadPosts();
                        };
                        comDiv.appendChild(deleteBtn);
                    }

                    div.appendChild(comDiv);
                });

            // Admin delete post button
            if (window.isAdmin) {
                const deletePostBtn = document.createElement("button");
                deletePostBtn.innerText = "Delete Post";
                deletePostBtn.style.display = "block";
                deletePostBtn.style.marginTop = "10px";
                deletePostBtn.onclick = async () => {
                    await fetch(`/deletePost/${post.id}`, { method: "DELETE" });
                    loadPosts();
                };
                div.appendChild(deletePostBtn);
            }

            container.appendChild(div);
        });

    } catch (err) {
        console.error("Load posts error:", err);
    }
}
// Load feed immediately, even before login
loadPosts();