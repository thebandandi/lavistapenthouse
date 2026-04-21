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
              INSTRUCTIONS:
              1. Research events in Los Cabos (San Lucas & San Jose) for the next 30 days.
              2. Visit https://www.visitloscabos.travel/events/ AND search for:
                 - San Jose del Cabo Art Walk (Every Thursday thru June)
                 - Wine and Music Night (San Jose, April 25)
                 - Arte Culinaria Festival at Montage (May 22-25)
                 - Sportfishing tournaments in the Marina.
              3. Write a high-end bilingual blog post for 'La Vista Penthouse'. 
                 - Focus on 2-3 events ranging from 'this week' to 'coming up this month'.
              4. Include the MANDATORY CTA: 'Book your stay at La Vista Penthouse. After booking, reach out to hosts for event reservation assistance.' (Include in Spanish too).
              5. End with: SEARCH_TERM: [one word for a photo]
            `
          }]
        }],
        tools: [{ "google_search": {} }] 
      })
    });

    const data = await aiResponse.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini returned no content. The search might have timed out.");
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

    return new Response(JSON.stringify({ message: "Success", image: displayImage }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Generation Failed", details: err.message }), { status: 500 });
  }
};
