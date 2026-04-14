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

      if (password !== passwordHeader) {
        return new Response("Unauthorized", { status: 401 });
      }

      if (action === "delete") {
        await store.delete(postId);
        return new Response(JSON.stringify({ message: "Deleted" }), { status: 200 });
      }

      if (action === "publish" || action === "edit" || action === "unpublish") {
        const post = await store.get(postId, { type: "json" });
        if (!post) return new Response("Post not found", { status: 404 });

        if (action === "publish") {
          post.status = "published";
          post.publishedAt = new Date().toISOString(); 
        } else if (action === "unpublish") {
          post.status = "draft";
          // We don't delete publishedAt, so you can see when it WAS live
        } else if (action === "edit") {
          post.title = updatedTitle;
          post.content = updatedContent;
          post.status = "draft"; 
        }

        await store.set(postId, JSON.stringify(post));
        return new Response(JSON.stringify({ message: "Success", post }), { status: 200 });
      }
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  // --- 2. HANDLING FETCHING (GET) ---
  const { blobs } = await store.list();
  const posts = [];

  for (const b of blobs) {
    const post = await store.get(b.key, { type: "json" });
    if (post) {
      if (isAdmin || post.status === "published") {
        posts.push({ id: b.key, ...post });
      }
    }
  }

  // FIXED SORTING: 
  // It now looks for publishedAt first, then falls back to createdAt or date.
  posts.sort((a, b) => {
    const dateA = new Date(a.publishedAt || a.createdAt || a.date);
    const dateB = new Date(b.publishedAt || b.createdAt || b.date);
    return dateB - dateA;
  });

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
