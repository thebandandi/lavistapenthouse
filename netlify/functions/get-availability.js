import { getStore } from "@netlify/blobs";
import axios from "axios";
import ical from "ical";

// ── THE MASTER CALENDAR LIST ────────────────────────────────────────────────
// This is where your site "listens" to other platforms.
const ICAL_SOURCES = {
  airbnb: "https://www.airbnb.com/calendar/ical/YOUR_AIRBNB_LINK_HERE.ics", 
  vrbo: "https://www.vrbo.com/icalendar/3455eef8b26146a79e73f68d86f6448c.ics?nonTentative",
  bookingCom: "" // Leave blank until manager sends it
};

export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    let allBlockedDates = [];

    // 1. PULL FROM EXTERNAL SITES (Airbnb, VRBO, etc.)
    for (const [platform, url] of Object.entries(ICAL_SOURCES)) {
      if (!url) continue;
      
      try {
        const response = await axios.get(url);
        const data = ical.parseICS(response.data);

        for (let k in data) {
          if (data[k].type === 'VEVENT') {
            const ev = data[k];
            allBlockedDates.push({
              start: ev.start.toISOString().split('T')[0],
              end: ev.end.toISOString().split('T')[0],
              source: platform
            });
          }
        }
      } catch (e) {
        console.error(`Failed to fetch ${platform} calendar:`, e.message);
      }
    }

    // 2. PULL FROM YOUR DIRECT BOOKINGS (The "Vault")
    const store = getStore("direct-bookings");
    const { blobs } = await store.list();
    
    for (const blob of blobs) {
      const booking = await store.get(blob.key, { type: "json" });
      if (booking) {
        const start = booking.checkin || booking.startDate;
        const end = booking.checkout || booking.endDate;
        if (start && end) {
          allBlockedDates.push({ start, end, source: "direct" });
        }
      }
    }

    return new Response(JSON.stringify({ blockedDates: allBlockedDates }), {
      status: 200,
      headers
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers
    });
  }
};
