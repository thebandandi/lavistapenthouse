import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Security Check
  const password = url.searchParams.get("password");
  if (password !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    if (!geminiKey) {
      return new Response("Error: GEMINI_API_KEY missing", { status: 500 });
    }

    // 2. The Gemini Endpoint - Wrapped correctly in backticks
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Write a catchy English Title, then a short English blog post (150 words) about Cabo life and the San Jose del Cabo Art Walk, then a header '## En Español' followed by a Spanish translation. Do not mention other hotels."
          }]
        }]
      })
    });

    const data = await aiResponse.json();

    if (!data.candidates || data.candidates.length === 0) {
      return new Response("Gemini Error: " + JSON.stringify(data), { status: 500 });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    const lines = fullText.split('\n').filter(l => l.trim() !== "");
    const title = lines[0].replace(/#/g, '').trim();

    // 3. Save Draft
    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: title,
      content: fullText,
      status: "draft",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      displayImage: "https://images.unsplash.com/photo-1512100356956-c1226c996cd0?auto=format&fit=crop&w=1200&q=80"
    }));

    return new Response(JSON.stringify({ message: "Success! Draft created." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response("Runtime Error: " + err.message, { status: 500 });
  }
};
