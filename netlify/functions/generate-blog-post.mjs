import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Security Check
  const password = url.searchParams.get("password");
  if (password !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    if (!geminiKey) {
      return new Response("Error: GEMINI_API_KEY is missing.", { status: 500 });
    }

    // 2. Gemini API Call
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a luxury concierge for La Vista Penthouse. Write a short bilingual blog post. 
            
            Structure:
            Line 1: A catchy English Title
            Line 2: The English blog post content (150 words). Focus on Cabo art, food, or nature. No other hotels.
            Line 3: The header "## En Español"
            Line 4: The Spanish translation.
            
            Context: Mention the San Jose del Cabo Art Walk and the luxury of the La Vista rooftop.`
          }]
        }]
      })
    });

    const data = await aiResponse.json();
    const fullText = data.candidates[0].content.parts[0].text;

    // 3. Parsing logic
    const lines = fullText.split('\n').filter(l => l.trim() !== "");
    const title = lines[0].replace(/#/g, '').trim();

    // 4. Save to Store
    const postId = `post-${Date.now()}`;
    const newPost = {
      id: postId,
      title: title || "Cabo Lifestyle Update",
      content: fullText,
      status: "draft",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      displayImage: "https://images.unsplash.com/photo-1512100356956-c1226c996cd0?auto=format&fit=crop&w=1200&q=80"
    };

    await store.set(postId, JSON.stringify(newPost));

    return new Response(JSON.stringify({ message: "Success!", post: newPost }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response("Gemini Error: " + err.message, { status: 500 });
  }
};
