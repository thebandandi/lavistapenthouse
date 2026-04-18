import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const id = url.searchParams.get("id");
  const password = url.searchParams.get("password");
  const adminPassword = process.env.BLOG_ADMIN_PASSWORD;

  // 1. DELETE ACTION
  if (req.method === "POST" && action === "delete") {
    if (password !== adminPassword) return new Response("Unauthorized", { status: 401 });
    if (!id) return new Response("Missing ID", { status: 400 });
    
    await store.delete(id);
    return new Response(JSON.stringify({ message: "Deleted successfully" }), { status: 200 });
  }

  // 2. EDIT/PUBLISH ACTION
  if (req.method === "POST" && action === "edit") {
    if (password !== adminPassword) return new Response("Unauthorized", { status: 401 });
    const body = await req.json();
    await store.set(id, JSON.stringify(body));
    return new Response(JSON.stringify({ message: "Updated successfully" }), { status: 200 });
  }

  // 3. DEFAULT: LIST ALL POSTS (The 'Reader' logic)
  try {
    const list = await store.list();
    const posts = [];
    for (const item of list.blobs) {
      const raw = await store.get(item.key);
      posts.push({ ...JSON.parse(raw), id: item.key });
    }
    // Sort Newest First
    posts.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));

    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
