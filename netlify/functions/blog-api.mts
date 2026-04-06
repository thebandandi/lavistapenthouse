// netlify/functions/blog-api.mts
// Handles: GET /api/blog-api?action=list&status=published
//          POST /api/blog-api { action: "publish"|"delete", postId }
//
// SETUP: No extra env vars needed — uses Netlify Blobs automatically

import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

export default async (req: Request) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);

  // ── GET — list posts ───────────────────────────────────────────────────────
  if (req.method === "GET") {
    const status = url.searchParams.get("status") || "published";
    const { blobs } = await store.list();
    const posts = [];

    for (const blob of blobs) {
      try {
        const post = await store.get(blob.key, { type: "json" });
        if (post && (status === "all" || post.status === status)) {
          posts.push(post);
        }
      } catch {}
    }

    posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return new Response(JSON.stringify({ posts }), { headers: CORS });
  }

  // ── POST — publish or delete ───────────────────────────────────────────────
  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
    }

    const { action, postId, adminKey } = body;

    // Simple admin key check — set ADMIN_KEY in Netlify env vars
    if (adminKey !== process.env.ADMIN_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    if (!postId) {
      return new Response(JSON.stringify({ error: "postId required" }), { status: 400, headers: CORS });
    }

    if (action === "publish") {
      const post = await store.get(postId, { type: "json" });
      if (!post) return new Response(JSON.stringify({ error: "Post not found" }), { status: 404, headers: CORS });
      post.status = "published";
      post.publishedAt = new Date().toISOString();
      await store.setJSON(postId, post);
      return new Response(JSON.stringify({ success: true, post }), { headers: CORS });
    }

    if (action === "delete") {
      await store.delete(postId);
      return new Response(JSON.stringify({ success: true }), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: CORS });
  }

  return new Response("Method not allowed", { status: 405 });
};
