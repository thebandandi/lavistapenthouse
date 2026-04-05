// netlify/functions/send-confirmation.js
// Triggered after successful Stripe payment to send booking confirmation via SendGrid.
//
// SETUP:
//   1. In Netlify Dashboard → Site → Environment Variables, add:
//      SENDGRID_API_KEY   =  SG.xxxxxxxxxxxxxxxxxxxxxxxx  (from app.sendgrid.com → API Keys)
//      FROM_EMAIL         =  bookings@yourdomain.com       (must be verified in SendGrid)
//      HOST_EMAIL         =  jaday@yourdomain.com          (receives host copy)
//
//   2. Verify your sender domain/email in SendGrid → Settings → Sender Authentication
//
//   3. This function is called by the frontend after Stripe redirects back with ?booking=success

const https = require("https");

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { SENDGRID_API_KEY, FROM_EMAIL, HOST_EMAIL } = process.env;

  if (!SENDGRID_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "SENDGRID_API_KEY not set in Netlify environment variables" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { guestName, guestEmail, checkin, checkout, nights, guests, total, ref } = body;

  // ── Guest confirmation email ──────────────────────────────────────────────
  const guestHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; background: #faf8f4; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #1a3a4a; padding: 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 28px; margin: 0 0 4px; font-weight: 400; }
    .header p { color: rgba(255,255,255,0.7); font-size: 14px; margin: 0; }
    .body { padding: 36px 40px; }
    .body h2 { font-size: 22px; color: #1a3a4a; margin-bottom: 8px; }
    .body p { font-size: 15px; color: #444; line-height: 1.7; }
    .detail-box { background: #f5efe6; border-radius: 10px; padding: 20px 24px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #e0d8cc; }
    .detail-row:last-child { border-bottom: none; font-weight: 600; }
    .ref-box { text-align: center; padding: 16px; background: #1a3a4a; border-radius: 8px; margin: 20px 0; }
    .ref-box p { color: rgba(255,255,255,0.7); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 4px; }
    .ref-box strong { color: #c9a84c; font-size: 20px; letter-spacing: 0.12em; }
    .footer { text-align: center; padding: 24px 40px; background: #f5efe6; font-size: 12px; color: #999; }
    .footer a { color: #c4714a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>La Vista Penthouse</h1>
      <p>Cabo San Lucas, Baja California Sur, Mexico</p>
    </div>
    <div class="body">
      <h2>You're going to Cabo, ${guestName.split(' ')[0]}! 🎉</h2>
      <p>Your reservation is confirmed. We can't wait to welcome you to La Vista Penthouse. Below are your booking details.</p>
      <div class="detail-box">
        <div class="detail-row"><span>Property</span><span>La Vista Penthouse</span></div>
        <div class="detail-row"><span>Check-in</span><span>${checkin} after 3:00 PM</span></div>
        <div class="detail-row"><span>Checkout</span><span>${checkout} before 10:00 AM</span></div>
        <div class="detail-row"><span>Duration</span><span>${nights} night${nights !== 1 ? "s" : ""}</span></div>
        <div class="detail-row"><span>Guests</span><span>${guests}</span></div>
        <div class="detail-row"><span>Total paid</span><span>${total}</span></div>
      </div>
      <div class="ref-box">
        <p>Booking reference</p>
        <strong>${ref}</strong>
      </div>
      <p><strong>What happens next?</strong><br>
      Your hosts Jaday & Elihu will reach out 48 hours before check-in with exact address and keypad entry code. Have a question before then? Just reply to this email.</p>
      <p style="margin-top:20px;font-size:14px;color:#888;">Need help? Reply to this email or message your hosts directly through the booking site.</p>
    </div>
    <div class="footer">
      © 2026 La Vista Penthouse · <a href="#">Privacy Policy</a> · <a href="#">Terms</a>
    </div>
  </div>
</body>
</html>`;

  // ── Host notification email ───────────────────────────────────────────────
  const hostHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:24px;color:#333} .box{background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0} .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #ddd;font-size:14px} .row:last-child{border:none;font-weight:600}</style></head>
<body>
  <h2>📬 New Booking — La Vista Penthouse</h2>
  <p>A new reservation has been confirmed.</p>
  <div class="box">
    <div class="row"><span>Guest</span><span>${guestName}</span></div>
    <div class="row"><span>Email</span><span>${guestEmail}</span></div>
    <div class="row"><span>Check-in</span><span>${checkin}</span></div>
    <div class="row"><span>Checkout</span><span>${checkout}</span></div>
    <div class="row"><span>Nights</span><span>${nights}</span></div>
    <div class="row"><span>Guests</span><span>${guests}</span></div>
    <div class="row"><span>Total</span><span>${total}</span></div>
    <div class="row"><span>Ref</span><span>${ref}</span></div>
  </div>
  <p style="font-size:13px;color:#888">Remember to block these dates in your availability calendar and send check-in instructions 48hrs before arrival.</p>
</body>
</html>`;

  const sendEmail = (to, subject, html) =>
    new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL || "bookings@lavistapenthouse.com", name: "La Vista Penthouse" },
        subject,
        content: [{ type: "text/html", value: html }],
      });
      const req = https.request(
        {
          hostname: "api.sendgrid.com",
          path: "/v3/mail/send",
          method: "POST",
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
            else reject(new Error(`SendGrid ${res.statusCode}: ${data}`));
          });
        }
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });

  try {
    // Send both emails in parallel
    await Promise.all([
      sendEmail(guestEmail, `Booking Confirmed — La Vista Penthouse (${ref})`, guestHtml),
      HOST_EMAIL ? sendEmail(HOST_EMAIL, `New Booking: ${guestName} · ${checkin} – ${checkout}`, hostHtml) : Promise.resolve(),
    ]);
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("SendGrid error:", err.message);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
