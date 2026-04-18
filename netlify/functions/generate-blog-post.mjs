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

    // This is the "Universal" stable endpoint that does not expire.
    const baseUrl = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=';
    const endpoint = baseUrl + geminiKey.trim();
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Write a luxury bilingual blog post for La Vista Penthouse. Focus on Cabo events for April 2026. Structure: English Title, English Body (150 words), then '## En Español', then Spanish Body. End with IMG_KEYWORDS: [3 keywords]"
          }]
        }]
      })
    });

    const data = await aiResponse.json();

    // Catching the 404 or Quota issues before the code crashes
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
      title: title,
      content: blogBody,
      displayImage: displayImage,
      status: 'draft',
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success! Check your dashboard." }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server Error", message: err.message }), { status: 500 });
  }
};
