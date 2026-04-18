import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;
  const openAiKey = process.env.OPENAI_API_KEY;

  // 1. Security Check
  const password = url.searchParams.get("password");
  if (password !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 2. Direct API Call (Bypasses library issues)
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a luxury concierge for La Vista Penthouse. Write a short bilingual blog post. Section 1: English (120 words). Section 2: '## En Español' followed by Spanish translation. Rules: No other hotels. Focus on Cabo local life and La Vista's rooftop luxury."
          },
          { role: "user", content: "Write a post about the San Jose del Cabo Art Walk and seasonal April activities." }
        ],
        max_tokens: 800
      })
    });

    const aiData = await aiResponse.json();
    if (!aiData.choices) throw new Error("AI failed: " + JSON.stringify(aiData));

    const content = aiData.choices[0].message.content;
    const title = content.split('\n')[0].replace(/#/g, '').trim();

    // 3. Reliable Image
    const displayImage = "https://images.unsplash.com/photo-1512100356956-c1226c996cd0?auto=format&fit=crop&w=1200&q=80";

    // 4. Save to Store
    const postId = `post-${Date.now()}`;
    const newPost = {
      title: title || "New Cabo Update",
      content: content,
      status: "draft",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      displayImage: displayImage
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
