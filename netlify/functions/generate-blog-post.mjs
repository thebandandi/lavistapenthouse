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
    
    const dynamicPrompt = `
      ACT AS: A local Cabo host and expert concierge for 'La Vista Penthouse'.
      TASK: Research and write a fresh, inviting blog post about things to do in Cabo for the next 30 days.
      
      RESEARCH PHASE:
      1. Priority Sources: https://www.visitloscabos.travel/events/, gringogazette.com, and loscabosguide.com.
      2. Priority Content: Look for timely events first (festivals, markets, art walks).
      3. SUPPLEMENTAL STRATEGY: If there are fewer than 3 major events, supplement the post with "Evergreen Activities" found on loscabosguide.com (e.g., horseback riding, ATV tours, snorkeling at Chileno Bay, or local landmark attractions).
      
      STRICT CONSTRAINTS:
      - **NO COMPETITOR NAMES**: Do not mention other hotels, resorts, or branded accommodations. Refer to locations by district or venue name only.
      - **LA VISTA EDGE**: Frame these activities as "easily accessible from your home base at La Vista Penthouse."
      
      WRITING PHASE:
      - Highlight a total of 3 items (mix of events and activities).
      - BILINGUAL REQUIREMENT: Full English version, then a complete Spanish translation starting with '## En Español'.
      - STYLE: Inviting, knowledgeable, and authentic.
      
      CTA: Include the HTML button for https://lavistapenthouse.com/#booking-widget at the end of BOTH language sections.
      End with: SEARCH_TERM: [one keyword]
    `;

    // 1. ATTEMPT DEEP SEARCH
    let aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "SEARCH AND WRITE: " + dynamicPrompt }] }],
        tools: [{ "google_search": {} }]
      })
    });

    let data = await aiResponse.json();
    let fullText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // 2. FALLBACK
    if (!fullText) {
      const fallbackRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "KNOWLEDGE GENERATION: " + dynamicPrompt }] }]
        })
      });
      const fallbackData = await fallbackRes.json();
      fullText = fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text;
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
            if (pexelsData?.photos?.length > 0) {
                displayImage = pexelsData.photos[0].src.large;
            }
        }
    }

    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: blogBody.split('\n')[0].replace(/#/g, '').trim() || "Cabo Life Update",
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
