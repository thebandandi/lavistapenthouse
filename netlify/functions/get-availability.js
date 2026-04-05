// netlify/functions/get-availability.js

const ICAL_FEEDS = [
  {
    name: "Airbnb",
    url: "https://www.airbnb.com/calendar/ical/1034347605075023527.ics?t=54358584f4f546d8a2c2f7aad04f31ab&locale=es-419"
  }
];

function parseIcal(icalData) {
  const blockedRanges = [];
  const eventBlocks = icalData.split("BEGIN:VEVENT");
  eventBlocks.shift();

  for (const block of eventBlocks) {
    let dtstart = null, dtend = null;
    const startMatch = block.match(/DTSTART(?:;VALUE=DATE)?(?:;TZID=[^:]+)?:([\dT Z]+)/);
    const endMatch   = block.match(/DTEND(?:;VALUE=DATE)?(?:;TZID=[^:]+)?:([\dT Z]+)/);

    if (startMatch) {
      const raw = startMatch[1].trim().replace(/Z$/, "");
      dtstart = raw.length >= 8 ? raw.substring(0, 8) : null;
      if (dtstart) dtstart = `${dtstart.substring(0,4)}-${dtstart.substring(4,6)}-${dtstart.substring(6,8)}`;
    }
    if (endMatch) {
      const raw = endMatch[1].trim().replace(/Z$/, "");
      dtend = raw.length >= 8 ? raw.substring(0, 8) : null;
      if (dtend) dtend = `${dtend.substring(0,4)}-${dtend.substring(4,6)}-${dtend.substring(6,8)}`;
    }

    if (dtstart && dtend && dtstart !== dtend) {
      blockedRanges.push([dtstart, dtend]);
    }
  }
  return blockedRanges;
}

exports.handler = async () => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=1800", // Cache for 30 minutes
  };

  try {
    // Fetch the Airbnb calendar using built-in fetching
    const icalResults = await Promise.all(
      ICAL_FEEDS.map(async (feed) => {
        try {
          const response = await fetch(feed.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" // Prevents Airbnb from blocking the request
            }
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.text();
          return parseIcal(data);
        } catch (err) {
          console.error(`Failed to fetch ${feed.name}:`, err);
          return [];
        }
      })
    );

    const allRanges = icalResults.flat();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ranges: allRanges,
        fetchedAt: new Date().toISOString()
      }),
    };
  } catch (err) {
    console.error("Availability fetch error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, ranges: [] }),
    };
  }
};
