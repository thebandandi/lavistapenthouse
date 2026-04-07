import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = {
    "Content-Type": "text/calendar",
    "Content-Disposition": "attachment; filename=lavista-penthouse.ics",
    "Cache-Control": "public, max-age=3600"
  };

  try {
    // We are using the "direct-bookings" store we set up previously
    const store = getStore("direct-bookings");
    const { blobs } = await store.list();
    
    let icalContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//La Vista Penthouse//Direct Bookings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:La Vista Direct"
    ];

    for (const blob of blobs) {
      const booking = await store.get(blob.key, { type: "json" });
      if (!booking) continue;

      // This logic handles both "checkin" and "startDate" formats
      const startRaw = booking.checkin || booking.startDate;
      const endRaw = booking.checkout || booking.endDate;

      if (!startRaw || !endRaw) continue;

      // Format YYYY-MM-DD to YYYYMMDD
      const start = startRaw.replace(/-/g, "");
      const end = endRaw.replace(/-/g, "");

      icalContent.push("BEGIN:VEVENT");
      icalContent.push(`DTSTART;VALUE=DATE:${start}`);
      icalContent.push(`DTEND;VALUE=DATE:${end}`);
      icalContent.push(`SUMMARY:Reserved - La Vista Direct`);
      icalContent.push(`DESCRIPTION:Direct booking ref: ${booking.ref || 'Direct'}`);
      icalContent.push(`UID:${blob.key}@lavistapenthouse.com`);
      icalContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
      icalContent.push("END:VEVENT");
    }

    icalContent.push("END:VCALENDAR");

    return new Response(icalContent.join("\r\n"), { status: 200, headers });
  } catch (err) {
    console.error("iCal Export Error:", err);
    return new Response("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR", { status: 200, headers });
  }
};
