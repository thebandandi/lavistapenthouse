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
    
    // 💡 ONLY CHANGED THE PROMPT TEXT BELOW TO BE MORE INSISTENT ON SPANISH
    const luxuryPrompt = `
      ACT AS: An expert luxury travel concierge for 'La Vista Penthouse'.
      TASK: Write an extensive, sophisticated blog post about luxury events in Cabo for May 2026.
      DETAILS: Research https://www.visitloscabos.travel/events/ for Fashion Week, the Mandapa culinary takeover, and Sunset Fest.
      STYLE: Ritz-Carlton/Luxury Magazine tone. High-end storytelling.
      
      BILINGUAL REQUIREMENT: 
      1. Write the full English version.
      2. Then, write a complete Spanish translation starting with the header '## En Español'. 
      THIS IS MANDATORY.
      
      CTA: Include the HTML button for https://lavistapenthouse.com/#booking-widget at the end of both the English AND the Spanish sections.
      End with: SEARCH_TERM: [one keyword]
    `;

    // 1. ATTEMPT DEEP SEARCH
    let aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "SEARCH AND WRITE: " + luxuryPrompt }] }],
        tools: [{ "google_search": {} }]
      })
    });

    let data = await aiResponse.json();
    
    let fullText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // 2. FALLBACK: If Search failed or returned an error
    if (!fullText) {
      console.warn("Search Tool failed. Switching to internal knowledge...");
      const fallbackRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "KNOWLEDGE GENERATION: " + luxuryPrompt }] }]
        })
      });
      const fallbackData = await fallbackRes.json();
      fullText = fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (!fullText) {
      throw new Error("Gemini API is currently unavailable. Please try again in 1 minute.");
    }

    const [blogBody, searchTermRaw] = fullText.split('SEARCH_TERM:');
    let searchTerm = searchTermRaw ? searchTermRaw.trim().replace(/[\[\]]/g, '').split(' ')[0] : "Cabo";

    // 📸 Pexels Image Fetch
    let displayImage = "https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg";
    if (pexelsKey) {
        const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchTerm)}&per_page=1`, {
            headers: { "Authorization": pexelsKey.trim() }
        });
        if (pexelsRes.ok) {
            const pexelsData = await pexelsRes.json();
            if (pexelsData?.photos?.length > 0) {
                displayImage = pexelsData.photos[0].src.large;
            }
        }
    }

    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: blogBody.split('\n')[0].replace(/#/g, '').trim() || "Cabo Luxury Update",
      content: blogBody.trim(),
      displayImage: displayImage,
      status: 'draft',
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success" }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Generation Error", details: err.message }), { status: 500 });
  }
};
