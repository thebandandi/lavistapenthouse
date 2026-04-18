import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (url.searchParams.get("password") !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    if (!geminiKey) return new Response("Error: GEMINI_API_KEY missing", { status: 500 });

    // 2026 STABLE PRODUCTION MODEL: gemini-2.5-flash
    // This model is officially supported and is NOT a preview.
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Search for luxury events in San Jose del Cabo for late April 2026. Write a bilingual blog post for La Vista Penthouse. Structure: English Title, English Body, ## En Español, Spanish Body. End with: IMG_KEYWORDS: [3 keywords]"
          }]
        }],
        // Using the standard stable 'google_search' tool
        tools: [{ "google_search": {} }] 
      })
    });

    const data = await aiResponse.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: "Google API Error", details: data.error }), { status: 500 });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    const contentParts = fullText.split('IMG_KEYWORDS:');
    const blogBody = contentParts[0].trim();
    const keywords = contentParts[1] ? contentParts[1].trim().replace(/[\[\]]/g, '') : "Cabo,Luxury";

    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: blogBody.split('\n')[0].replace(/#/g, '').trim(),
      content: blogBody,
      displayImage: `https://images.unsplash.com/photo-1512100356956-c1226c996cd0?auto=format&fit=crop&w=800&q=80`,
      status: 'draft',
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success! Stable 2.5 Active." }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Runtime Error", message: err.message }), { status: 500 });
  }
};
