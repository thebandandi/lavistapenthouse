import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const anthropicKey = process.env.ANTHROPIC_API_KEY; // Ensure this name matches your Netlify setting

  // 1. Security Check
  const password = url.searchParams.get("password");
  if (password !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    if (!anthropicKey) {
      return new Response("Error: ANTHROPIC_API_KEY is missing in Netlify settings.", { status: 500 });
    }

    // 2. Anthropic API Call
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey.trim(),
        "anthropic-version": "2023-06-01", // Required by Anthropic
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307", // Fast and efficient for blog drafts
        max_tokens: 1024,
        system: "You are a luxury concierge for La Vista Penthouse. Write a short bilingual blog post. Section 1: English (120 words). Section 2: '## En Español' followed by Spanish translation. Rules: No other hotels. Focus on Cabo local life and La Vista's rooftop luxury.",
        messages: [
          { role: "user", content: "Write a post about April activities in Cabo, specifically the Art Walk." }
        ]
      })
    });

    const aiData = await aiResponse.json();
    
    if (aiData.error) {
      throw new Error(`Anthropic Error: ${aiData.error.message}`);
    }

    const content = aiData.content[0].text;
    const title = content.split('\n')[0].replace(/#/g, '').trim();

    // 3. Save to Store
    const postId = `post-${Date.now()}`;
    const newPost = {
      title: title || "New Cabo Update",
      content: content,
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
    return new Response("Error: " + err.message, { status: 500 });
  }
};
