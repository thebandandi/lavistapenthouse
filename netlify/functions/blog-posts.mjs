import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const isAdmin = url.searchParams.get("admin") === "true";
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;

  // --- 1. HANDLING UPDATES (POST) ---
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { action, postId, updatedContent, updatedTitle, password } = body;

      // Security check
      if (password !== passwordHeader) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (action === "delete") {
        await store.delete(postId);
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
      }

      if (action === "publish" || action === "edit") {
        const post = await store.get(postId, { type: "json" });
        if (!post) return new Response("Post not found", { status: 404 });

        if (action === "publish") {
          post.status = "published";
        } else if (action === "edit") {
          post.title = updatedTitle;
          post.content = updatedContent;
          post.status = "draft"; // Keep as draft after edit
        }

        await store.set(postId, JSON.stringify(post));
        return new Response(JSON.stringify({ message: "Success", post }), { status: 200 });
      }

    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  // --- 2. HANDLING FETCHING (GET) ---
  // This is your original logic that shows posts on the site
  const { blobs } = await store.list();
  const posts = [];

  for (const b of blobs) {
    const post = await store.get(b.key, { type: "json" });
    if (post) {
      // If not admin, only show published posts
      if (isAdmin || post.status === "published") {
        posts.push({ id: b.key, ...post });
      }
    }
  }

  // Sort by date (newest first)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
