// netlify/functions/blog-action.mjs
// Handles publish and delete actions from the admin panel
//
// POST /api/blog-action
// Body: { action: "publish"|"delete", id: "draft-xxx", password: "..." }

import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const { action, id, password } = body;

  // Auth check
  if (password !== "Cabovacationforme33!") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  if (!id || !action) {
    return new Response(JSON.stringify({ error: "Missing id or action" }), { status: 400, headers });
  }

  try {
    const store = getStore("blog-posts");

    if (action === "delete") {
      await store.delete(id);
      return new Response(JSON.stringify({ success: true, message: "Post deleted" }), { status: 200, headers });
    }

    if (action === "publish") {
      const post = await store.get(id, { type: "json" });
      if (!post) {
        return new Response(JSON.stringify({ error: "Post not found" }), { status: 404, headers });
      }
      // Change slug to published id so it's publicly listable
      const publishedId = `published-${Date.now()}`;
      await store.setJSON(publishedId, {
        ...post,
        id: publishedId,
        status: "published",
        publishedAt: new Date().toISOString(),
      });
      await store.delete(id);
      return new Response(JSON.stringify({ success: true, message: "Post published", publishedId }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers });
  } catch (err) {
    console.error("Blog action error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
