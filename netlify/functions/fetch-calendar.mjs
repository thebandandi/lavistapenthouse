import { getStore } from "@netlify/blobs";
import axios from "axios";
import ical from "ical";

const ICAL_SOURCES = {
  airbnb: "https://www.airbnb.com/calendar/ical/1034347605075023527.ics?t=54358584f4f546d8a2c2f7aad04f31ab&locale=es-419", 
  vrbo: "https://www.vrbo.com/icalendar/3455eef8b26146a79e73f68d86f6448c.ics?nonTentative",
  bookingCom: "" 
};

export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };

  try {
    let allBlockedDates = [];

    // 1. PULL FROM EXTERNAL SITES
    for (const [platform, url] of Object.entries(ICAL_SOURCES)) {
      if (!url) continue;
      try {
        const response = await axios.get(url);
        const data = ical.parseICS(response.data);

        for (let k in data) {
          if (data[k].type === 'VEVENT') {
            const ev = data[k];
          const startDate = new Date(ev.start).toISOString().split('T')[0];
const endDate = new Date(ev.end).toISOString().split('T')[0];

allBlockedDates.push({
  start: startDate,
  end: endDate,
  source: platform
});
          }
        }
      } catch (e) { console.error(`Failed ${platform}:`, e.message); }
    }

    // 2. PULL FROM DIRECT VAULT
    try {
      const store = getStore("direct-bookings");
      const { blobs } = await store.list();
      for (const blob of blobs) {
        const b = await store.get(blob.key, { type: "json" });
        if (b) {
          const s = b.checkin || b.startDate;
          const e = b.checkout || b.endDate;
          if (s && e) allBlockedDates.push({ start: s, end: e, source: "direct" });
        }
      }
    } catch (blobErr) { console.log("Blob store empty or unavailable"); }

    // This is the NEW format. If you see "blockedDates" in your browser, it's working!
    return new Response(JSON.stringify({ 
      blockedDates: allBlockedDates,
      updatedAt: new Date().toISOString() 
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
};
