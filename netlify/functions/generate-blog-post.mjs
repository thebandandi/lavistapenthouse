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
    
    // ⚡ FASTER, SIMPLER SEARCH
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Search for 2-3 luxury events in Cabo for May 2026. 
            Use information from https://www.visitloscabos.travel/events/
            Write a bilingual blog post for 'La Vista Penthouse'. 
            Include the 'Check Availability' button linking to https://lavistapenthouse.com/#booking-widget.
            End with: SEARCH_TERM: [one word]`
          }]
        }],
        tools: [{ "google_search": {} }] 
      })
    });

    const data = await aiResponse.json();

    // 🛡️ RECOVERY: If the search failed, we generate a high-end "General Cabo" post 
    // so you NEVER get an error screen again.
    let fullText;
    if (!data.candidates || data.candidates.length === 0) {
      console.log("Web search timed out, falling back to general luxury content...");
      const fallbackRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "The web search timed out. Instead, write a general luxury 'May in Cabo' guide for La Vista Penthouse. Focus on the Art Walk and Marina dining. Include the same CTA and SEARCH_TERM format."
            }]
          }]
        })
      });
      const fallbackData = await fallbackRes.json();
      fullText = fallbackData.candidates[0].content.parts[0].text;
    } else {
      fullText = data.candidates[0].content.parts[0].text;
    }

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
    return new Response(JSON.stringify({ error: "Generation Failed", details: err.message }), { status: 500 });
  }
};
