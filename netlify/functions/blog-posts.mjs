import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // STEP 1: Try 'posts'. If still empty after deploy, change this to 'site'
  const STORE_NAME = "content"; 
  
  try {
    const store = getStore(STORE_NAME);
    const list = await store.list();
    const posts = [];

    for (const item of list.blobs) {
      const raw = await store.get(item.key);
      try {
        const data = JSON.parse(raw);
        posts.push({ ...data, id: item.key });
      } catch (parseErr) {
        // Skip corrupted files
        continue; 
      }
    }

    // Sort by date (newest first)
    posts.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    // If this fails, it will return JSON instead of an HTML error
    return new Response(JSON.stringify({ error: error.message, store: STORE_NAME }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
