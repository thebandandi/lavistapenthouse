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

    // Using single quotes here to prevent the "Expected ;" backtick error
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';
    const endpoint = baseUrl + geminiKey.trim();
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "You are a luxury concierge for La Vista Penthouse. TASK: Check https://www.visitloscabos.travel/events/ for upcoming events in April/May 2026. Write a bilingual blog post (English section, then '## En Español', then Spanish section). Include 1 specific event from the site. No other hotels. End the post with: IMG_KEYWORDS: [3 keywords]"
          }]
        }]
      })
    });

    const data = await aiResponse.json();

    if (!data || !data.candidates || data.candidates.length === 0) {
      return new Response(JSON.stringify({
        error: "Quota or API Issue",
        debug: data 
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    const contentParts = fullText.split('IMG_KEYWORDS:');
    const blogBody = contentParts[0].trim();
    const keywords = contentParts[1] ? contentParts[1].trim().replace(/[\[\]]/g, '') : "Cabo,Luxury,Beach";
    
    const lines = blogBody.split('\n').filter(l => l.trim() !== "");
    const title = lines[0].replace(/#/g, '').trim();
    const displayImage = 'https://source.unsplash.com/800x600/?' + encodeURIComponent(keywords);

    const postId = 'post-' + Date.now();
    await store.set(postId, JSON.stringify({
      id: postId,
      title: title || "New Cabo Update",
      content: blogBody,
      displayImage: displayImage,
      status: "draft",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success!" }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Runtime Error", message: err.message }), { status: 500 });
  }
};
