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

    // UPDATED FOR APRIL 2026: 
    // gemini-3-flash-preview is the current stable flash model.
    const baseUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-3-flash-preview:generateContent?key=';
    const endpoint = baseUrl + geminiKey.trim();
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Write a luxury bilingual blog post for La Vista Penthouse. TASK: Include one local event for April/May 2026 in Cabo. Structure: English Title, English Body, then '## En Español', then Spanish Body. End with IMG_KEYWORDS: [3 keywords]"
          }]
        }]
      })
    });

    const data = await aiResponse.json();

    if (!data || !data.candidates) {
      return new Response(JSON.stringify({ error: "API Version Error", debug: data }), { status: 500 });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    const contentParts = fullText.split('IMG_KEYWORDS:');
    const blogBody = contentParts[0].trim();
    const keywords = contentParts[1] ? contentParts[1].trim().replace(/[\[\]]/g, '') : "Cabo,Luxury";
    
    const title = blogBody.split('\n')[0].replace(/#/g, '').trim();
    const displayImage = 'https://source.unsplash.com/800x600/?' + encodeURIComponent(keywords);

    const postId = 'post-' + Date.now();
    await store.set(postId, JSON.stringify({
      id: postId,
      title: title,
      content: blogBody,
      displayImage: displayImage,
      status: "draft",
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success!" }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Runtime Error", message: err.message }), { status: 500 });
  }
};
