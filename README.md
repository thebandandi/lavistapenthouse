# La Vista Penthouse — Booking Website

A full-stack vacation rental booking site for La Vista Penthouse, Cabo San Lucas.

## Tech Stack

| Layer | Service | Purpose |
|---|---|---|
| Frontend | HTML/CSS/JS | Single-file, no build step |
| Payments | Stripe Checkout | Hosted payment page |
| Email | SendGrid | Booking confirmations + contact form |
| Serverless | Netlify Functions | Secure API calls (keeps SendGrid key private) |
| Hosting | Netlify | Free tier, auto-deploys from GitHub |

---

## Setup Guide

### Step 1 — Stripe (you already have an account ✅)

1. Go to **dashboard.stripe.com/products** → Add product
   - Name: `Nightly Stay — La Vista Penthouse`
   - Pricing: One-time, USD $350.00
   - Copy the **Price ID** (starts with `price_...`)

2. Go to **dashboard.stripe.com/apikeys**
   - Copy your **Publishable key** (starts with `pk_live_...`)
   - Use `pk_test_...` while testing

3. Open `index.html` and replace in the CONFIG block:
   ```js
   STRIPE_PUBLISHABLE_KEY: "pk_live_YOUR_KEY_HERE",
   STRIPE_PRICE_ID:        "price_YOUR_PRICE_ID_HERE",
   ```

---

### Step 2 — SendGrid

1. Sign up at **app.sendgrid.com** (free: 100 emails/day)

2. **Verify your sender:**
   - Settings → Sender Authentication
   - Either verify a full domain (recommended) or a single sender email

3. **Create an API key:**
   - Settings → API Keys → Create API Key
   - Give it "Mail Send" permission only
   - Copy the key (starts with `SG.`)

4. **Add to Netlify Environment Variables** (NOT in the HTML file):
   - Netlify Dashboard → Your Site → Site Configuration → Environment Variables
   - Add these three variables:
     ```
     SENDGRID_API_KEY  =  SG.xxxxxxxxxxxxxxxxxxxxxxxx
     FROM_EMAIL        =  bookings@yourdomain.com   (must match verified sender)
     HOST_EMAIL        =  you@youremail.com         (receives copy of every booking + message)
     ```

---

### Step 3 — Deploy to Netlify

**Option A: Drag & Drop (easiest)**
1. Go to **netlify.com** → Log in → Sites → "Deploy manually"
2. Drag this entire project folder onto the page
3. Done — your site is live in ~30 seconds

**Option B: GitHub (recommended — enables auto-deploy)**
1. Push this folder to a GitHub repo
2. In Netlify: Add new site → Import from Git → select your repo
3. Build settings: Leave blank (no build step needed)
4. Deploy

---

### Step 4 — Update Availability Calendar

Open `index.html` and edit the `BOOKED_RANGES` array:

```js
const BOOKED_RANGES = [
  ["2026-03-20","2026-03-24"],  // Add each confirmed booking
  ["2026-04-01","2026-04-05"],
  // ...
];
```

Redeploy after each update (or connect to GitHub for auto-deploy).

---

## Project Structure

```
la-vista-penthouse/
├── index.html                        ← Main site (all frontend)
├── netlify.toml                      ← Netlify build + routing config
├── netlify/
│   └── functions/
│       ├── send-confirmation.js      ← Booking confirmation email (SendGrid)
│       └── contact.js                ← Contact form handler (SendGrid)
└── README.md
```

## How It Works End-to-End

```
Guest selects dates
       ↓
Price calculated client-side
       ↓
Guest fills booking form → clicks "Confirm & Pay"
       ↓
Guest data saved to sessionStorage
       ↓
Stripe.redirectToCheckout() → Stripe hosted payment page
       ↓ (on success)
Stripe redirects to ?booking=success&ref=LVP-XXXXXX
       ↓
Frontend reads sessionStorage, calls POST /api/send-confirmation
       ↓
Netlify Function calls SendGrid API (server-side, key stays private)
       ↓
SendGrid sends:
  • Confirmation email to guest (branded HTML)
  • Notification email to host (booking details)
       ↓
Success screen shown to guest
```

---

## Custom Domain

1. Buy a domain (e.g. `lavistapenthouse.com`) at Namecheap, Cloudflare, Google Domains
2. In Netlify → Domain Management → Add custom domain
3. Follow DNS instructions (takes ~5–30 min to propagate)
4. Netlify provides free SSL automatically

---

## Pricing Adjustments

All in `index.html` CONFIG block:

```js
NIGHTLY_RATE:   350,   // Base nightly rate in USD
CLEANING_FEE:   75,    // One-time cleaning fee
SERVICE_FEE_PCT: 0.14, // 14% service fee (applied to nightly + cleaning)
MAX_GUESTS:     6,
MIN_NIGHTS:     2,
```
