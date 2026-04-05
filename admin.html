// netlify/functions/get-availability.js
// Fetches blocked dates from:
// 1. Airbnb iCal feed (live)
// 2. VRBO iCal feed (add URL when ready)
// 3. Booking.com iCal feed (add URL when ready)
// 4. Direct bookings saved in Netlify Blobs

const https = require("https");
const http = require("http");
const { getStore } = require("@netlify/blobs");

// ── Add your iCal URLs here ──────────────────────────────────────────────────
const ICAL_FEEDS = [
  {
    name: "Airbnb",
    url: "https://www.airbnb.com/calendar/ical/1034347605075023527.ics?t=54358584f4f546d8a2c2f7aad04f31ab&locale=es-419"
  },
  // Add VRBO and Booking.com URLs below when ready:
  // { name: "VRBO", url: "https://..." },
  // { name: "Booking.com", url: "https://..." },
];

function fetchIcal(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, { method: "GET", headers: { "User-Agent": "LaVistaPenthouse/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchIcal(res.headers.location).then(resolve);
        return;
      }
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", () => resolve(""));
    req.setTimeout(8000, () => { req.destroy(); resolve(""); });
    req.end();
  });
}

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

// Fetch direct bookings from Netlify Blobs
async function fetchDirectBookings() {
  try {
    const store = getStore("direct-bookings");
    const { blobs } = await store.list();
    const ranges = [];
    for (const blob of blobs) {
      const booking = await store.get(blob.key, { type: "json" });
      if (booking && booking.checkin && booking.checkout) {
        ranges.push([booking.checkin, booking.checkout]);
      }
    }
    console.log(`Direct bookings: ${ranges.length} found`);
    return ranges;
  } catch (err) {
    console.warn("Could not fetch direct bookings:", err.message);
    return [];
  }
}

exports.handler = async () => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=1800", // Cache 30 mins
  };

  try {
    // Fetch iCal feeds and direct bookings in parallel
    const [icalResults, directRanges] = await Promise.all([
      Promise.all(
        ICAL_FEEDS.map(async (feed) => {
          const data = await fetchIcal(feed.url);
          const ranges = parseIcal(data);
          console.log(`${feed.name}: ${ranges.length} blocked ranges`);
          return ranges;
        })
      ),
      fetchDirectBookings(),
    ]);

    // Merge all ranges
    const allRanges = [...icalResults.flat(), ...directRanges];
    console.log(`Total blocked ranges: ${allRanges.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ranges: allRanges,
        fetchedAt: new Date().toISOString(),
        sources: {
          ical: icalResults.map((r, i) => ({ name: ICAL_FEEDS[i].name, count: r.length })),
          direct: directRanges.length,
        }
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
