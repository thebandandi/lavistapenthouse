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
    
    // 🧠 THE HIGH-END PROMPT
    const luxuryPrompt = `
      ACT AS: An expert luxury travel concierge for 'La Vista Penthouse' in Cabo.
      TASK: Write an extensive, sophisticated blog post about luxury events in Cabo for May 2026.
      DETAILS: Focus on Los Cabos Fashion Week, the Mandapa x Zadún culinary takeover, and Sunset Fest. 
      STYLE: Ritz-Carlton/Luxury Magazine tone.
      FORMAT: Full English version, then '## En Español' version.
      CTA: Include the HTML button for https://lavistapenthouse.com/#booking-widget at the end of both sections.
      End with: SEARCH_TERM: [one keyword]
    `;

    // ⚡ TRY DEEP SEARCH FIRST
    let aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "RESEARCH AND WRITE: " + luxuryPrompt }] }],
        tools: [{ "google_search": {} }]
      })
    });

    let data = await aiResponse.json();

    // 🛡️ RECOVERY LOGIC: If search fails or returns empty, run INSTANT GENERATION
    let fullText;
    if (!data.candidates || data.candidates.length === 0) {
      console.warn("Search timed out. Switching to High-End Knowledge generation...");
      const fallbackRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "GENERATE FROM KNOWLEDGE: " + luxuryPrompt }] }]
        })
      });
      const fallbackData = await fallbackRes.json();
      fullText = fallbackData.candidates[0].content.parts[0].text;
    } else {
      fullText = data.candidates[0].content.parts[0].text;
    }

    const [blogBody, searchTermRaw] = fullText.split('SEARCH_TERM:');
    let searchTerm = searchTermRaw ? searchTermRaw.trim().replace(/[\[\]]/g, '').split(' ')[0] : "Cabo Luxury";

    // 📸 Pexels Image Fetch
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
    return new Response(JSON.stringify({ error: "System Error", details: err.message }), { status: 500 });
  }
};
