const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const AIRBNB_ICAL_URL = "https://www.airbnb.com/calendar/ical/1034347605075023527.ics?t=54358584f4f546d8a2c2f7aad04f31ab&locale=es-419";
  
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  try {
    // 1. Fetch live dates from Airbnb
    const response = await fetch(AIRBNB_ICAL_URL);
    const icalData = await response.text();
    const ranges = [];
    
    // Simple parsing logic for Airbnb ICS format
    const events = icalData.split("BEGIN:VEVENT");
    events.forEach(ev => {
      const startMatch = ev.match(/DTSTART;VALUE=DATE:(\d{8})/);
      const endMatch = ev.match(/DTEND;VALUE=DATE:(\d{8})/);
      if (startMatch && endMatch) {
        const s = startMatch[1];
        const e = endMatch[1];
        ranges.push([
          `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`,
          `${e.slice(0,4)}-${e.slice(4,6)}-${e.slice(6,8)}`
        ]);
      }
    });

    // 2. Fetch direct bookings from your database
    const store = getStore("direct-bookings");
    const list = await store.list();
    for (const item of list.blobs) {
      const data = await store.getJSON(item.key);
      if (data && data.checkin) ranges.push([data.checkin, data.checkout]);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, ranges }),
    };

  } catch (err) {
    console.error("Sync Error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Sync Failed", details: err.message }),
    };
  }
};
