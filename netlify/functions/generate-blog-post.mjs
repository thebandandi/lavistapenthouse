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

    // API Update April 2026: Use gemini-3.1-flash-preview for Grounding
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-preview:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Search for current luxury events in San Jose del Cabo or Cabo San Lucas for late April 2026. Write a bilingual blog post for La Vista Penthouse. Structure: English Title, English Body, ## En Español, Spanish Body. End with: IMG_KEYWORDS: [3 keywords]"
          }]
        }],
        // FIXED SYNTAX: Changed google_search_retrieval to google_search
        tools: [{ "google_search": {} }] 
      })
    });

    const data = await aiResponse.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: "Google API Issue", details: data.error }), { status: 500 });
    }

    if (!data.candidates || data.candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No content generated", debug: data }), { status: 500 });
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

    return new Response(JSON.stringify({ message: "Success! Post found current events." }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server Error", message: err.message }), { status: 500 });
  }
};
