import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  if (url.searchParams.get("password") !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1. Get Gemini Content
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Search for luxury events in Cabo for late April 2026. Write a bilingual blog post. End with: SEARCH_TERM: [one simple word for a photo, e.g. 'beach' or 'villa']"
          }]
        }],
        tools: [{ "google_search": {} }] 
      })
    });

    const data = await aiResponse.json();
    const fullText = data.candidates[0].content.parts[0].text;
    const [blogBody, searchTermRaw] = fullText.split('SEARCH_TERM:');
    
    // Clean up the search term (Pexels likes simple tags)
    let searchTerm = searchTermRaw ? searchTermRaw.trim().replace(/[\[\]]/g, '').split(' ')[0] : "Cabo";

    // 2. Fetch Image with strict error handling
    let displayImage = "https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg"; // High-end default
    
    if (pexelsKey) {
        console.log(`Searching Pexels for: ${searchTerm}`);
        const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`, {
            headers: { 
                "Authorization": pexelsKey.trim(),
                "User-Agent": "LaVistaAdmin" 
            }
        });

        if (pexelsRes.ok) {
            const pexelsData = await pexelsRes.json();
            if (pexelsData.photos && pexelsData.photos.length > 0) {
                displayImage = pexelsData.photos[0].src.large;
            }
        } else {
            console.error("Pexels API Error:", pexelsRes.status);
        }
    }

    // 3. Save to Store
    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: blogBody.split('\n')[0].replace(/#/g, '').trim(),
      content: blogBody.trim(),
      displayImage: displayImage,
      status: 'draft',
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success", image: displayImage }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
