// netlify/functions/blog-posts.mjs
// GET /api/blog-posts          → list all published posts
// GET /api/blog-posts?id=xxx   → get single post
// GET /api/blog-posts?drafts=1&password=xxx → list drafts (admin only)

import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const drafts = url.searchParams.get("drafts");
  const password = url.searchParams.get("password");

  try {
    const store = getStore("blog-posts");

    // Single post fetch
    if (id) {
      const post = await store.get(id, { type: "json" });
      if (!post || (post.status === "draft" && password !== "Cabovacationforme33!")) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
      }
      return new Response(JSON.stringify(post), { status: 200, headers });
    }

    // List all keys
    const { blobs } = await store.list();
    const posts = [];

    for (const blob of blobs) {
      const post = await store.get(blob.key, { type: "json" });
      if (!post) continue;
      if (drafts && password === "Cabovacationforme33!") {
        if (post.status === "draft") posts.push(post);
      } else {
        if (post.status === "published") posts.push(post);
      }
    }

    // Sort newest first
    posts.sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));

    return new Response(JSON.stringify(posts), { status: 200, headers });
  } catch (err) {
    console.error("Blog fetch error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
