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
    // ⚡ Using the high-performance 2.5-flash model with search enabled
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
              1. Research events in Los Cabos (San Lucas & San Jose) for the next 30 days via https://www.visitloscabos.travel/events/
              2. Write a high-end bilingual blog post for 'La Vista Penthouse'.
              3. MANDATORY CTA: At the end of BOTH the English and Spanish sections, include this HTML:
                 <div style="text-align: center; margin: 40px 0;">
                   <a href="https://lavistapenthouse.com/#booking-widget" style="background-color: #1a3a4a; color: #c9a84c; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">Check Availability & Book Direct</a>
                   <p style="font-size: 14px; margin-top: 15px; color: #6b6b6b;">Book direct to save 5%. After booking, contact hosts for event reservation assistance.</p>
                 </div>
              4. End exactly with: SEARCH_TERM: [one word]
            `
          }]
        }],
        tools: [{ "google_search": {} }]
      })
    });

    const data = await aiResponse.json();

    // 🛡️ PROTECTION: If Gemini returns an empty candidate list, we catch it here
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Search timed out or returned no data. Please try one more time.");
    }

    const fullText = data.candidates[0].content.parts[0].text;
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

    return new Response(JSON.stringify({ message: "Success" }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Generation Snag", details: err.message }), { status: 500 });
  }
};
