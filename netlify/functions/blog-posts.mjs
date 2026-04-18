import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const STORE_NAME = "blog-posts"; 
  
  try {
    const store = getStore(STORE_NAME);
    const list = await store.list();
    const posts = [];

    for (const item of list.blobs) {
      const raw = await store.get(item.key);
      try {
        const data = JSON.parse(raw);
        // We ensure ID is present for the dashboard to work
        posts.push({ ...data, id: item.key });
      } catch (parseErr) {
        continue; 
      }
    }

    // Sort: Newest at the top
    posts.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
