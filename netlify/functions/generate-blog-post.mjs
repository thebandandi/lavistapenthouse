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

    // Using the current stable v1beta for better web-search/grounding capabilities
    const endpoint = https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey.trim()};
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a luxury concierge for La Vista Penthouse. 
            TASK: Check https://www.visitloscabos.travel/events/ for upcoming April/May 2026 events.
            Write a bilingual blog post (English first, then '## En Español', then Spanish).
            Include 1 specific event from the site.
            No other hotels. 
            IMPORTANT: End the post with a line exactly like this: IMG_KEYWORDS: [3 keywords]`
          }]
        }]
      })
    });

    const data = await aiResponse.json();

    // --- SAFETY CATCH: Prevents the "undefined (reading '0')" error ---
    if (!data || !data.candidates || data.candidates.length === 0) {
      console.error("Gemini Response Error:", data);
      return new Response(JSON.stringify({
        error: "AI failed to generate content.",
        debug: data // This tells you exactly what Google said
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    const contentParts = fullText.split('IMG_KEYWORDS:');
    const blogBody = contentParts[0].trim();
    const keywords = contentParts[1] ? contentParts[1].trim().replace(/[\[\]]/g, '') : "Cabo,Luxury,Beach";
    
    const title = blogBody.split('\n')[0].replace(/#/g, '').trim();
    const displayImage = `https://source.unsplash.com/800x600/?${encodeURIComponent(keywords)}`;

    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: title || "New Cabo Update",
      content: blogBody,
      displayImage: displayImage,
      status: "draft",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success! Check your dashboard." }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server Crash", message: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" } 
    });
  }
};
