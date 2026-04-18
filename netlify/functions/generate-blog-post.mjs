import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  
  // These must match your Netlify Environment Variable names exactly
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Security Check
  // Ensure the password in your URL matches the one in Netlify settings
  const password = url.searchParams.get("password");
  if (password !== passwordHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized: Password mismatch" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // 2. Configuration Check
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "Config Error: GEMINI_API_KEY is missing in Netlify settings." }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Gemini API Configuration
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey.trim()}`;
    
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a luxury concierge for La Vista Penthouse in Cabo. 
            Write a short bilingual blog post. 
            
            STRUCTURE:
            Line 1: A catchy English Title (No hashtags or bolding)
            Line 2: The English blog post body (approx 150 words). Focus on local Cabo culture like the Art Walk, seasonal dining, or rooftop relaxation. 
            Line 3: The header "## En Español"
            Line 4: A professional Spanish translation of the English section.
            
            STRICT RULES:
            - Do NOT mention other hotels, resorts, or lodging.
            - Focus only on local experiences and the luxury of La Vista Penthouse.`
          }]
        }],
        // These settings prevent the AI from blocking standard travel/lifestyle content
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await aiResponse.json();

    // 4. Robust Response Handling
    if (!data.candidates || data.candidates.length === 0) {
      // This will output the full Google error if the API blocks the prompt
      return new Response(JSON.stringify({ 
        error: "Gemini failed to return content.", 
        details: data 
      }), { status: 500 });
    }

    const fullText = data.candidates[0].content.parts[0].text;
    
    // Split text into lines to extract the title
    const lines = fullText.split('\n').filter(l => l.trim() !== "");
    const title = lines[0].replace(/#/g, '').trim();

    // 5. Save to Netlify Blobs
    const postId = `post-${Date.now()}`;
    const newPost = {
      id: postId,
      title: title || "Cabo Lifestyle Update",
      content: fullText,
      status: "draft",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      // Default high-quality Cabo-style image
      displayImage: "https://images.unsplash.com/photo-1512100356956-c1226c996cd0?auto=format&fit=crop&w=1200&q=80"
    };

    await store.set(postId, JSON.stringify(newPost));

    return new Response(JSON.stringify({ 
      message: "Success! Draft Created.", 
      post: newPost 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ 
      error: "Server Error", 
      message: err.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
