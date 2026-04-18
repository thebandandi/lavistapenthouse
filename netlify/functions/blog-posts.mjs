import { getStore } from "@netlify/blobs";

export const handler = async (event) => {
  // Pointing to 'posts' to find your missing 50 drafts
  const store = getStore("posts");
  
  try {
    const list = await store.list();
    const posts = [];

    for (const item of list.blobs) {
      const raw = await store.get(item.key);
      try {
        const data = JSON.parse(raw);
        // We include the key as the ID just in case
        posts.push({ ...data, id: item.key });
      } catch (parseErr) {
        console.error(`Error parsing blob ${item.key}`);
      }
    }

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
      body: JSON.stringify(posts),
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Failed to list store 'posts'", details: error.message }) 
    };
  }
};
