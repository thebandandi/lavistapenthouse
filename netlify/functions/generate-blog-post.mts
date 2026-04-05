// netlify/functions/generate-blog-post.mts
// Scheduled to run weekly — generates a Cabo blog post draft using Claude API
// Schedule is set in netlify.toml
//
// SETUP — add these to Netlify Environment Variables:
//   ANTHROPIC_API_KEY  = your Claude API key (console.anthropic.com)
//   BLOB_TOKEN         = auto-provided by Netlify Blobs (no action needed)
//   ADMIN_EMAIL        = email address to notify when draft is ready
//   FORMSPREE_BLOG     = your Formspree endpoint for blog notifications
//                        Create a second Formspree form called "Blog Notifications"

import { getStore } from "@netlify/blobs";

const TOPICS = [
  "the best things to do in Cabo San Lucas this week, including outdoor activities, water sports, and sightseeing",
  "top restaurants and dining experiences in Cabo San Lucas, from local tacos to fine dining with ocean views",
  "upcoming events and festivals in Cabo San Lucas and the Los Cabos region",
  "water activities and boat tours in Cabo San Lucas, including snorkeling, whale watching, and sunset cruises",
  "essential travel tips for first-time visitors to Cabo San Lucas, including getting around, what to pack, and local customs",
  "local news and updates from Cabo San Lucas, including new attractions, infrastructure updates, and community events",
];

export default async (req: Request) => {
  const { ANTHROPIC_API_KEY, ADMIN_EMAIL, FORMSPREE_BLOG } = process.env;

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), { status: 500 });
  }

  // Pick a topic — rotate through them based on current week number
  const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const topic = TOPICS[weekNum % TOPICS.length];

  // ── Call Claude API ────────────────────────────────────────────────────────
  const prompt = `You are a travel and lifestyle writer for La Vista Penthouse, a luxury vacation rental in Cabo San Lucas, Mexico. Write an engaging, informative blog post about ${topic}.

Requirements:
- Tone: warm, knowledgeable, insider perspective — like a friend who lives in Cabo
- Length: 400-600 words
- Include a catchy headline
- Include 3-4 subheadings to break up the content
- End with a subtle call to action mentioning La Vista Penthouse as a great base for exploring Cabo
- Do NOT invent specific fake business names, phone numbers, or addresses
- Write in a style that would appeal to luxury vacation rental guests
- Format as JSON with these exact fields: { "title": "...", "excerpt": "...(2 sentence summary)", "content": "...(full HTML with <h2> subheadings and <p> tags)", "topic": "...", "readTime": "X min read" }
- Return ONLY the JSON object, no markdown, no backticks`;

  let postData;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text.replace(/```json|```/g, "").trim();
    postData = JSON.parse(text);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Claude API error", details: String(err) }), { status: 500 });
  }

  // ── Save draft to Netlify Blobs ────────────────────────────────────────────
  const store = getStore("blog-posts");
  const postId = `draft_${Date.now()}`;
  const post = {
    id: postId,
    status: "draft",
    title: postData.title,
    excerpt: postData.excerpt,
    content: postData.content,
    topic: postData.topic || topic,
    readTime: postData.readTime || "5 min read",
    createdAt: new Date().toISOString(),
    publishedAt: null,
    slug: postData.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  };

  await store.setJSON(postId, post);

  // ── Send email notification via Formspree ─────────────────────────────────
  if (FORMSPREE_BLOG && ADMIN_EMAIL) {
    try {
      await fetch(FORMSPREE_BLOG, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `New Blog Draft Ready: "${post.title}"`,
          email: ADMIN_EMAIL,
          message: `A new blog post draft has been generated and is ready for your review.\n\nTitle: ${post.title}\n\nExcerpt: ${post.excerpt}\n\nReview and publish at: https://www.lavistapenthouse.com/admin`,
        }),
      });
    } catch (e) {
      console.warn("Notification email failed:", e);
    }
  }

  return new Response(JSON.stringify({ success: true, postId, title: post.title }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = { schedule: "@weekly" };
