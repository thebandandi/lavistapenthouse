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

    // Using the 'v1beta' with 'gemini-1.5-flash-latest' 
    // This is the most compatible combination for Free Tier keys in 2026.
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=';
    const endpoint = baseUrl + geminiKey.trim();
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Write a luxury bilingual blog post for La Vista Penthouse Cabo. Include one local event from https://www.visitloscabos.travel/events/ for April/May 2026. Structure: English Title, English Body, then '## En Español', then Spanish Body. End with IMG_KEYWORDS: [3 keywords]"
          }]
        }]
      })
    });

    const data = await aiResponse.json();

    // Check for Google-specific errors
    if (data.error) {
      return new Response(JSON.stringify({ error: "Google API Error", details: data.error }), { status: 500 });
    }

    if (!data.candidates || data.candidates.length === 0) {
      return new Response(JSON.stringify({ error: "No content generated", debug: data }), { status: 500 });
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
      title: title || "Cabo Luxury Update",
      content: blogBody,
      displayImage: displayImage,
      status: 'draft',
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success! Post is in your dashboard." }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server Error", message: err.message }), { status: 500 });
  }
};
