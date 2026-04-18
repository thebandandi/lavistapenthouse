import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (url.searchParams.get("password") !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a luxury concierge for La Vista Penthouse in Cabo. 
            
            TASK: 
            1. Search/Reference local events from https://www.visitloscabos.travel/events/ for the current month.
            2. Write a bilingual blog post (English/Spanish).
            3. Include a specific upcoming event if it is relevant to a luxury guest.
            
            STRUCTURE:
            Line 1: Catchy English Title
            Line 2: English Content (150 words). Include local events, Art Walk, and rooftop luxury. No other hotels.
            Line 3: ## En Español
            Line 4: Spanish Translation.
            
            KEYWORDS FOR IMAGE: At the very end, add a line starting with 'IMG_KEYWORDS:' followed by 3 descriptive keywords (e.g., IMG_KEYWORDS: Cabo, Sunset, Yacht).`
          }]
        }]
      })
    });

    const data = await aiResponse.json();
    const fullText = data.candidates[0].content.parts[0].text;
    
    // Logic to separate the text from the keywords
    const contentParts = fullText.split('IMG_KEYWORDS:');
    const blogBody = contentParts[0].trim();
    const keywords = contentParts[1] ? contentParts[1].trim() : "Cabo,Luxury";
    
    const title = blogBody.split('\n')[0].replace(/#/g, '').trim();

    // Use a dynamic Unsplash URL that picks a photo based on AI keywords
    const displayImage = `https://source.unsplash.com/800x600/?${encodeURIComponent(keywords)}`;

    const postId = `post-${Date.now()}`;
    await store.set(postId, JSON.stringify({
      id: postId,
      title: title,
      content: blogBody,
      displayImage: displayImage, // This is the "Featured Image"
      status: "draft",
      date: new Date().toISOString()
    }));

    return new Response(JSON.stringify({ message: "Success!" }), { status: 200 });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
};
