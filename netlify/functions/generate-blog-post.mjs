import { getStore } from "@netlify/blobs";
import https from "https";
import http from "http";

// ── News RSS feeds for Cabo San Lucas ────────────────────────────────────────
const RSS_FEEDS = [
  { name: "Los Cabos Guide",     url: "https://www.loscabosguide.com/feed/" },
  { name: "The Baja Post",       url: "https://thebajapost.com/feed/" },
  { name: "Baja California Sur", url: "https://bajasur.com.mx/feed/" },
  { name: "Los Cabos Tourism",   url: "https://www.visitloscabos.travel/feed/" },
  { name: "Gringo Gazette",      url: "https://gringogazette.com/feed/" },
];

const TOPICS = [
  "things to do in Cabo San Lucas this week",
  "best restaurants in Cabo San Lucas",
  "water activities and tours in Cabo San Lucas",
  "events and festivals in Cabo San Lucas",
  "travel tips for visiting Cabo San Lucas",
  "beaches and outdoor activities in Cabo San Lucas",
  "nightlife and entertainment in Cabo San Lucas",
  "local news and updates from Cabo San Lucas",
];

const IMAGE_QUERIES = {
  "things to do":    "Cabo San Lucas Mexico activities",
  "restaurants":     "Cabo San Lucas restaurant dining",
  "water activities":"Cabo San Lucas ocean water sports",
  "events":          "Cabo San Lucas festival Mexico",
  "travel tips":     "Cabo San Lucas Mexico travel",
  "beaches":         "Cabo San Lucas beach Mexico",
  "nightlife":       "Cabo San Lucas nightlife Mexico",
  "local news":      "Cabo San Lucas Mexico scenery",
};

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").substring(0, 80);
}

function getImageQuery(topic) {
  for (const [key, query] of Object.entries(IMAGE_QUERIES)) {
    if (topic.toLowerCase().includes(key)) return query;
  }
  return "Cabo San Lucas Mexico";
}

// Fetch and parse RSS feed headlines
function fetchRSSHeadlines(feedUrl) {
  return new Promise((resolve) => {
    const url = new URL(feedUrl);
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: { "User-Agent": "LaVistaPenthouse-Blog/1.0" },
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchRSSHeadlines(res.headers.location).then(resolve);
        return;
      }
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          // Extract titles from RSS XML
          const titles = [];
          const titleRegex = /<item[^>]*>[\s\S]*?<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<item[^>]*>[\s\S]*?<title[^>]*>(.*?)<\/title>/gi;
          let match;
          while ((match = titleRegex.exec(data)) !== null && titles.length < 5) {
            const title = (match[1] || match[2] || "").trim();
            if (title && title.length > 5) titles.push(title);
          }
          resolve({ feed: feedUrl, titles });
        } catch (e) {
          resolve({ feed: feedUrl, titles: [] });
        }
      });
    });
    req.on("error", () => resolve({ feed: feedUrl, titles: [] }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ feed: feedUrl, titles: [] }); });
    req.end();
  });
}

// Fetch all RSS feeds in parallel
async function fetchAllHeadlines() {
  const results = await Promise.all(RSS_FEEDS.map(f => fetchRSSHeadlines(f.url)));
  const headlines = [];
  results.forEach((result, i) => {
    if (result.titles.length > 0) {
      headlines.push(`From ${RSS_FEEDS[i].name}:`);
      result.titles.forEach(t => headlines.push(`  • ${t}`));
    }
  });
  return headlines;
}

function fetchUnsplashImage(query) {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    const req = https.request({
      hostname: "api.unsplash.com",
      path: `/search/photos?query=${encodedQuery}&per_page=10&orientation=landscape`,
      method: "GET",
      headers: {
        "Authorization": `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        "Accept-Version": "v1",
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.results && parsed.results.length > 0) {
            const idx = Math.floor(Math.random() * Math.min(parsed.results.length, 5));
            const photo = parsed.results[idx];
            resolve({
              url: photo.urls.regular,
              thumb: photo.urls.small,
              photographer: photo.user.name,
              photographerUrl: photo.user.links.html,
              alt: photo.alt_description || query,
            });
          } else { resolve(null); }
        } catch (e) { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    const req = https.request({
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY.trim(),
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          if (!parsed.content || !parsed.content[0]) { reject(new Error("No content: " + data)); return; }
          resolve(parsed.content[0].text);
        } catch (e) { reject(new Error("Parse error: " + e.message)); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export default async () => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set"); return; }

    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    console.log("Topic:", topic);

    // Fetch news headlines and image in parallel
    console.log("Fetching news headlines and image...");
    const [headlines, image] = await Promise.all([
      fetchAllHeadlines(),
      process.env.UNSPLASH_ACCESS_KEY ? fetchUnsplashImage(getImageQuery(topic)) : Promise.resolve(null),
    ]);

    const newsContext = headlines.length > 0
      ? `\n\nHere are recent headlines from Cabo news sources to help inform your post:\n${headlines.join("\n")}`
      : "";

    console.log(`Found ${headlines.length} headlines from RSS feeds`);

    const systemPrompt = `
  You are an expert local concierge for La Vista Penthouse in Cabo San Lucas. 
  Generate a short, high-end bilingual blog post (English followed by Spanish).

  STRICT CONTENT RULES:
  1. NO mentions of other hotels, resorts, or lodging (avoid "great stays" elsewhere).
  2. Focus on the Cabo experience: local dining, seasonal activities (like fishing or whale watching), or hidden beaches.
  3. Always tie the activity back to La Vista Penthouse (e.g., "After exploring, relax on our private rooftop").

  FORMATTING RULES:
  - Header: Use "## English" and "## En Español" to separate the two sections.
  - Length: Approximately 150 words per language.
  - Tone: Sophisticated, inviting, and professional.
`;

    console.log("Calling Claude API...");
    const raw = await callClaude(prompt);

    let post;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      post = JSON.parse(clean);
    } catch (e) {
      try {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          post = JSON.parse(raw.substring(start, end + 1));
        } else {
          console.error("No JSON found:", raw.substring(0, 300));
          return;
        }
      } catch (e2) {
        console.error("JSON parse failed:", raw.substring(0, 300));
        return;
      }
    }

    const store = getStore("blog-posts");
    const id = `draft-${Date.now()}`;
    await store.setJSON(id, {
      id,
      slug: generateSlug(post.title),
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      tags: post.tags || [],
      topic,
      status: "draft",
      createdAt: new Date().toISOString(),
      publishedAt: null,
      image: image || null,
      // Store prompt and sources for admin visibility
      promptUsed: prompt,
      newsSources: RSS_FEEDS.map(f => f.name),
      headlinesUsed: headlines,
    });
    console.log("Draft saved successfully:", post.title);

  } catch (err) {
    console.error("Blog generation error:", err.message || err);
  }
};

export const config = { schedule: "0 0 * * 1" };
