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

    // 2. Updated April 2026 Stable Endpoint
    // We use gemini-2.5-flash which is the current 2026 workhorse
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Write a high-end bilingual blog post for La Vista Penthouse. Structure: Catchy Title (first line), English section (150 words), then '## En Español' header, then Spanish translation. No other hotels. Focus on the Art Walk and Cabo lifestyle."
          }]
        }]
      })
    });

    const data = await aiResponse.json();

    if (!data.candidates || data.candidates.length === 0) {
      return new Response("Gemini API Error: " + JSON.stringify(data), { status: 500 });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    const lines = fullText.split('\n').filter(l => l.trim() !== "");
    const title = lines[0].replace(/#/g, '').trim();

    // 3. Save Draft to Vault
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

    return new Response(JSON.stringify({ message: "Success! Bilingual draft created." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response("Runtime Error: " + err.message, { status: 500 });
  }
};
