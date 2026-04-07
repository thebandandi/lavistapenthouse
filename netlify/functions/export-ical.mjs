import { getStore } from "@netlify/blobs";

export default async (req) => {
  const headers = {
    "Content-Type": "text/calendar",
    "Content-Disposition": "attachment; filename=lavista-penthouse.ics"
  };

  try {
    const store = getStore("site-bookings");
    const { blobs } = await store.list();
    
    let icalContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//La Vista Penthouse//Direct Bookings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    for (const blob of blobs) {
      const booking = await store.get(blob.key, { type: "json" });
      if (!booking || !booking.startDate || !booking.endDate) continue;

      // Format dates for iCal (YYYYMMDD)
      const start = booking.startDate.replace(/-/g, "");
      const end = booking.endDate.replace(/-/g, "");

      icalContent.push("BEGIN:VEVENT");
      icalContent.push(`DTSTART;VALUE=DATE:${start}`);
      icalContent.push(`DTEND;VALUE=DATE:${end}`);
      icalContent.push(`SUMMARY:Reserved - La Vista Direct`);
      icalContent.push(`UID:${blob.key}@lavistapenthouse.com`);
      icalContent.push("END:VEVENT");
    }

    icalContent.push("END:VCALENDAR");

    return new Response(icalContent.join("\r\n"), { status: 200, headers });
  } catch (err) {
    return new Response("Error generating calendar", { status: 500 });
  }
};
