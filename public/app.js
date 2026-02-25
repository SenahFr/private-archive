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
            document.getElementById("login").style.display = "none";
            document.getElementById("app").style.display = "block"; // show post form
            loadPosts(); // refresh feed
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
    if (!commentText) return;
    try {
        const res = await fetch("/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, comment: commentText })
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

        // posts array may be empty or undefined
        (data.posts || []).forEach(post => {
            let div = document.createElement("div");
            div.className = "post";
            div.innerHTML = `
                <b>${post.username}</b> (${new Date(post.timestamp).toLocaleString()})<br>
                ${post.text}<br>
                ${post.media ? `<img src="/uploads/${post.media}" style="max-width:200px"><br>` : ""}
            `;

            // show comment input only if logged in
            if (document.getElementById("app").style.display === "block") {
                const commentInput = document.createElement("input");
                commentInput.id = "comment-" + post.id;
                commentInput.placeholder = "Add comment";
                const commentButton = document.createElement("button");
                commentButton.innerText = "Comment";
                commentButton.onclick = () => addComment(post.id);
                div.appendChild(commentInput);
                div.appendChild(commentButton);
            }

            // existing comments
            (data.comments || []).filter(c => c.post_id === post.id).forEach(c => {
                let comDiv = document.createElement("div");
                comDiv.className = "comment";
                comDiv.innerText = `${c.username}: ${c.comment}`;
                div.appendChild(comDiv);
            });

            container.appendChild(div);
        });
    } catch (err) {
        console.error("Load posts error:", err);
    }
}

// Load feed immediately, even before login
loadPosts();