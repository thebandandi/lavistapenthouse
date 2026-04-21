import { getStore } from "@netlify/blobs";

export const config = {
  schedule: "0 0 * * 0" 
};

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  const isScheduled = req.headers.get("x-netlify-event") === "schedule";
  const hasValidPassword = url.searchParams.get("password") === passwordHeader;

  if (!isScheduled && !hasValidPassword) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
    
    // LAYER 1: The Request
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Search for luxury events in Cabo for the next 30 days at https://www.visitloscabos.travel/events/. Write a high-end bilingual blog for 'La Vista Penthouse'. Include the booking CTA button and end with SEARCH_TERM: [one word]."
          }]
        }],
        tools: [{ "google_search": {} }]
      })
    });

    const data = await aiResponse.json();

    // LAYER 2: The "Ghost Response" Protection
    // We check every single step of the data path before touching it.
    let fullText = "";
    if (data && data.candidates && data.candidates.length > 0 && 
        data.candidates[0].content && data.candidates[0].content.parts && 
        data.candidates[0].content.parts.length > 0) {
        
        fullText = data.candidates[0].content.parts[0].text;
    } 

    // LAYER 3: The Fallback (If Gemini failed to search)
    if (!fullText || fullText.length < 10) {
      console.warn("Gemini Search failed or returned empty. Running Fallback...");
      const fallbackRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "The web search was slow. Please write a luxury 'Welcome to Spring in Cabo' blog for La Vista Penthouse. Focus on the Art Walk and Marina. Include the standard booking CTA and SEARCH_TERM: [one word]."
            }]
          }]
        })
      });
      const fallbackData = await fallbackRes.json();
      fullText = fallbackData.candidates[0].content.parts[0].text;
    }

    // Process the final text
    const [blogBody, searchTermRaw] = fullText.split('SEARCH_TERM:');
    let searchTerm = searchTermRaw ? searchTermRaw.trim().replace(/[\[\]]/g, '').split(' ')[0] : "Cabo";

    // Pexels Image Fetch
    let displayImage = "https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg";
    if (pexelsKey) {
        const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`, {
            headers: { "Authorization": pexelsKey.trim() }
        });
        if (pexelsRes.ok) {
            const pexelsData = await pexelsRes.json();
            if (pexelsData.photos && pexelsData.photos.length > 0) {
                displayImage = pexelsData.photos[0].src.large;
            }
        }
    }

    // Save to database
    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: blogBody.split('\n')[0].replace(/#/g, '').trim(),
      content: blogBody.trim(),
      displayImage: displayImage,
      status: 'draft',
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success", mode: data.candidates ? "Search" : "Fallback" }), { status: 200 });

  } catch (err) {
    console.error("Critical System Error:", err.message);
    return new Response(JSON.stringify({ error: "System Error", details: err.message }), { status: 500 });
  }
};
