import { getStore } from "@netlify/blobs";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async (req, context) => {
  const store = getStore("blog-posts");
  const url = new URL(req.url);
  const passwordHeader = process.env.BLOG_ADMIN_PASSWORD;

  // 1. Security Check
  const password = url.searchParams.get("password");
  if (password !== passwordHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 2. Faster AI Request (Lower tokens = less chance of timeout)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Faster and cheaper
      messages: [
        {
          role: "system",
          content: `You are a luxury concierge for La Vista Penthouse. 
          Write a short bilingual blog post. 
          Section 1: English (120 words). 
          Section 2: "## En Español" followed by Spanish translation.
          Rules: No other hotels. Focus on Cabo local life and La Vista's rooftop luxury.`
        },
        { role: "user", content: "Write a post about the best local seasonal activities in Cabo for April." }
      ],
      max_tokens: 800
    });

    const content = completion.choices[0].message.content;
    const title = content.split('\n')[0].replace('##', '').trim(); // Grabs the first line as title

    // 3. Simple Image fallback (Prevents Unsplash crashes)
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

    return new Response(JSON.stringify({ message: "Draft Created!", post: newPost }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response("Error: " + err.message, { status: 500 });
  }
};
