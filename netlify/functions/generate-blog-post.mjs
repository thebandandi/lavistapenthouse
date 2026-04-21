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
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
              ACT AS: An expert luxury travel writer and concierge for 'La Vista Penthouse' in Cabo.
              
              TASK:
              1. Deeply research https://www.visitloscabos.travel/events/ for luxury events in May 2026.
              2. Write an extensive, sophisticated blog post (Ritz-Carlton or high-end publication style).
              3. Include immersive descriptions of at least 3 major events (e.g., Los Cabos Fashion Week, the Mandapa x Zadún culinary takeover, or Sunset Fest).
              4. Provide the full content in ENGLISH followed by a full version in SPANISH (## En Español).
              
              MANDATORY CALL TO ACTION:
              At the end of BOTH the English and Spanish sections, insert this exact HTML code:
              <div style="text-align: center; margin: 40px 0;">
                <a href="https://lavistapenthouse.com/#booking-widget" style="background-color: #1a3a4a; color: #c9a84c; padding: 15px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block;">Check Availability & Book Direct</a>
                <p style="font-size: 14px; margin-top: 15px; color: #6b6b6b;">Book direct to save 5%. After booking, contact hosts for event reservation assistance.</p>
              </div>

              TERMINATE THE POST WITH: SEARCH_TERM: [one keyword for the image]
            `
          }]
        }],
        tools: [{ "google_search": {} }]
      })
    });

    const data = await aiResponse.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Search timed out. Please try again in 30 seconds.");
    }

    const fullText = data.candidates[0].content.parts[0].text;
    const [blogBody, searchTermRaw] = fullText.split('SEARCH_TERM:');
    let searchTerm = searchTermRaw ? searchTermRaw.trim().replace(/[\[\]]/g, '').split(' ')[0] : "Cabo Luxury";

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
    return new Response(JSON.stringify({ error: "Snag", details: err.message }), { status: 500 });
  }
};
