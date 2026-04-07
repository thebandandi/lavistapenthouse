import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = { 
    "Access-Control-Allow-Origin": "*", 
    "Content-Type": "application/json" 
  };
  
  const url = new URL(req.url);
  const password = url.searchParams.get("password");
  const showDrafts = url.searchParams.get("drafts") === "1";

  // Use the secret key from your Netlify Environment Variables
  const isAdmin = password === process.env.BLOG_ADMIN_PASSWORD;

  try {
    const store = getStore("blog-posts");
    const { blobs } = await store.list();
    const allPosts = [];

    for (const blob of blobs) {
      const post = await store.get(blob.key, { type: "json" });
      if (!post) continue;

      // Ensure every post has a usable image URL for the frontend
      if (post.image && typeof post.image === 'object' && post.image.url) {
        post.displayImage = post.image.url;
      } else {
        post.displayImage = post.image || "/images/default-blog.jpg";
      }

      // Logic: 
      // 1. If user is Admin and asked for drafts, give them EVERYTHING (Drafts + Published)
      // 2. Otherwise (Public view), give them ONLY Published
      if (showDrafts && isAdmin) {
        allPosts.push(post);
      } else if (!showDrafts && post.status === "published") {
        allPosts.push(post);
      }
    }

    // Sort by date (Newest first)
    allPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return new Response(JSON.stringify(allPosts), { status: 200, headers });
  } catch (err) {
    console.error("Blob Store Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
