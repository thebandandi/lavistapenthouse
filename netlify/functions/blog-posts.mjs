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

  const isAdmin = password === process.env.BLOG_ADMIN_PASSWORD;

  try {
    const store = getStore("blog-posts");

    if (id) {
      const post = await store.get(id, { type: "json" });
      if (!post || (post.status === "draft" && !isAdmin)) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
      }
      return new Response(JSON.stringify(post), { status: 200, headers });
    }

    const { blobs } = await store.list();
    const posts = [];

    for (const blob of blobs) {
      try {
        const post = await store.get(blob.key, { type: "json" });
        if (!post) continue;

        // --- IMAGE REPAIR LOGIC ---
        // If the image is the "bundle" from Unsplash, we extract just the URL 
        // so the website can actually display it.
        if (post.image && typeof post.image === 'object' && post.image.url) {
          post.displayImage = post.image.url;
        } else if (typeof post.image === 'string') {
          post.displayImage = post.image;
        } else {
          post.displayImage = "/images/default-blog.jpg"; // Fallback if no image exists
        }

        if (drafts && isAdmin) {
          if (post.status === "draft") posts.push(post);
        } else {
          if (post.status === "published") posts.push(post);
        }
      } catch (e) {
        console.error("Error reading blob:", blob.key);
      }
    }

    posts.sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
    return new Response(JSON.stringify(posts), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
