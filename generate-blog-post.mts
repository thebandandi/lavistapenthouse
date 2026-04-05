// netlify/functions/contact.js
// Handles the "Message Host" contact form, routing messages to the host via SendGrid.
//
// SETUP: Same environment variables as send-confirmation.js
//   SENDGRID_API_KEY, FROM_EMAIL, HOST_EMAIL

const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { SENDGRID_API_KEY, FROM_EMAIL, HOST_EMAIL } = process.env;

  if (!SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "SENDGRID_API_KEY not configured" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { name, email, dates, message } = body;
  if (!name || !email || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields" }) };
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:sans-serif;padding:24px;color:#333;max-width:560px}
  .box{background:#f5f5f5;border-radius:8px;padding:20px;margin:16px 0}
  .label{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:4px}
  .val{font-size:15px;color:#222;margin-bottom:16px}
  .message-box{background:#fff;border-left:4px solid #c4714a;padding:16px;font-size:15px;line-height:1.7;color:#333;white-space:pre-wrap}
</style></head>
<body>
  <h2>💬 New Message — La Vista Penthouse Website</h2>
  <div class="box">
    <div class="label">From</div><div class="val">${name} &lt;${email}&gt;</div>
    <div class="label">Travel dates mentioned</div><div class="val">${dates || "Not specified"}</div>
    <div class="label">Message</div>
    <div class="message-box">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  </div>
  <p style="font-size:12px;color:#aaa">Sent via La Vista Penthouse website contact form. Reply directly to this email to respond to the guest.</p>
</body>
</html>`;

  // Auto-reply to guest
  const autoReplyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Georgia,serif;background:#faf8f4;padding:0;margin:0}.wrap{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}.head{background:#1a3a4a;padding:32px;text-align:center}.head h1{color:#fff;font-size:24px;margin:0 0 4px;font-weight:400}.head p{color:rgba(255,255,255,.6);font-size:13px;margin:0}.body{padding:32px}.body p{font-size:15px;color:#444;line-height:1.8}.foot{background:#f5efe6;padding:20px;text-align:center;font-size:12px;color:#999}</style></head>
<body>
  <div class="wrap">
    <div class="head"><h1>La Vista Penthouse</h1><p>Cabo San Lucas, Mexico</p></div>
    <div class="body">
      <p>Hi ${name.split(" ")[0]},</p>
      <p>Thanks for reaching out! Your message has been received and your hosts <strong>Jaday & Elihu</strong> will reply within 24 hours.</p>
      <p>In the meantime, you can check availability and pricing at any time by visiting the booking site.</p>
      <p style="color:#888;font-size:13px;margin-top:24px;font-style:italic">Your message: "${message.substring(0, 120)}${message.length > 120 ? "..." : ""}"</p>
    </div>
    <div class="foot">© 2026 La Vista Penthouse</div>
  </div>
</body>
</html>`;

  const sendEmail = (to, subject, html, replyTo) =>
    new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL || "bookings@lavistapenthouse.com", name: "La Vista Penthouse" },
        reply_to: replyTo ? { email: replyTo } : undefined,
        subject,
        content: [{ type: "text/html", value: html }],
      });
      const req = https.request(
        { hostname: "api.sendgrid.com", path: "/v3/mail/send", method: "POST",
          headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
        (res) => { let d = ""; res.on("data", c => d += c); res.on("end", () => res.statusCode < 300 ? resolve(d) : reject(new Error(`${res.statusCode}: ${d}`))); }
      );
      req.on("error", reject); req.write(payload); req.end();
    });

  try {
    await Promise.all([
      HOST_EMAIL ? sendEmail(HOST_EMAIL, `New Message from ${name} — La Vista Penthouse`, html, email) : Promise.resolve(),
      sendEmail(email, "We received your message — La Vista Penthouse", autoReplyHtml),
    ]);
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("SendGrid contact error:", err.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
