import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  // We'll try the most common one, but the goal here is the ERROR log below
  const TEST_NAMES = ["posts", "site", "blog-posts", "blog", "data", "storage"];
  let discovery = {};

  try {
    for (const name of TEST_NAMES) {
      const store = getStore(name);
      const list = await store.list();
      discovery[name] = list.blobs.length;
    }

    return new Response(JSON.stringify({
      message: "Discovery Scan Complete",
      results: discovery,
      hint: "Look for the name that doesn't say 0"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      advice: "Ensure 'Netlify Blobs' is still enabled in your Netlify UI under Site Settings > Data"
    }), { status: 500 });
  }
};
