import { getStore } from "@netlify/blobs";

// This tells Netlify to wake up every Sunday at midnight
export const config = {
  schedule: "0 0 * * 0" 
};

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  // SECURITY: Allow if triggered by Netlify Schedule OR if valid password in URL
  const isScheduled = req.headers.get("x-netlify-event") === "schedule";
  const hasValidPassword = url.searchParams.get("password") === passwordHeader;

  if (!isScheduled && !hasValidPassword) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    if (!geminiKey) return new Response("Error: GEMINI_API_KEY missing", { status: 500 });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `
              INSTRUCTIONS:
              1. First, visit the official Los Cabos Tourism Calendar at https://www.visitloscabos.travel/events/
              2. Identify the most exciting luxury, cultural, or culinary events happening in BOTH Cabo San Lucas and San Jose del Cabo for the upcoming week.
              3. Write a high-end, bilingual blog post for 'La Vista Penthouse'. 
              4. TONE: Sophisticated, inviting, and knowledgeable.
              5. STRUCTURE: English Title, English Body, ## En Español, Spanish Body.
              6. CALL TO ACTION: At the end of both the English and Spanish sections, include a note inviting readers to book their stay at La Vista Penthouse. Add that after booking, guests should reach out to the hosts for assistance in making reservations for any specific events they are interested in.
              7. DATA FORMAT: End the entire response with exactly: SEARCH_TERM: [one specific word for a photo of Cabo luxury]
            `
          }]
        }],
        tools: [{ "google_search": {} }] 
      })
    });

    const data = await aiResponse.json();
    const fullText = data.candidates[0].content.parts[0].text;
    const [blogBody, searchTermRaw] = fullText.split('SEARCH_TERM:');
    
    // Clean up search term for Pexels
    let searchTerm = searchTermRaw ? searchTermRaw.trim().replace(/[\[\]]/g, '').split(' ')[0] : "Cabo";

    // 📸 PEXELS IMAGE FETCH
    let displayImage = "https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg"; // High-end fallback
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

    // 💾 SAVE TO DATABASE (LANDS IN DRAFTS)
    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: blogBody.split('\n')[0].replace(/#/g, '').trim(),
      content: blogBody.trim(),
      displayImage: displayImage,
      status: 'draft',
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ 
        message: "Success", 
        image: displayImage,
        context: isScheduled ? "Automated Sunday Run" : "Manual Generation"
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Server Error", details: err.message }), { status: 500 });
  }
};
