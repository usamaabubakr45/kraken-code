# Kraken Code — Complete Website Package + Appointment Booking System

Founder: **Usama Abu Bakr** — Web Dev Magician, AI Superstar, GTM Lead Gen Engineer
Package version: **3.0 (complete master + booking system)** · Built: 2026-09-29

---

## 1. What's inside

```
kraken-code/
├── index.html                  Full portfolio site + booking section (#booking)
├── favicon.ico                 Multi-size favicon (16/32/48)
├── robots.txt / sitemap.xml    SEO files
├── site.webmanifest            PWA manifest
├── package.json                Server deps (nodemailer, pdf-lib, @upstash/redis)
├── .env.example                Env-var template (Gmail app password etc.)
├── css/style.css               Full stylesheet incl. booking UI
├── js/
│   ├── main.js                 Site JS (visualizers, filter, lightbox, nav)
│   └── booking.js              Booking UI logic (slots, validation, submit)
├── api/
│   └── book.js                 Vercel serverless function (GET availability / POST booking)
├── lib/
│   ├── config.js               Services, hours, TZ, prices, brand — edit here
│   ├── receipt-pdf.js          Stylish PDF receipt generator (pdf-lib, in-house)
│   └── email-templates.js      Branded HTML emails + iCal invite (in-house)
├── test/test-booking.js        9 offline API tests (npm test)
├── preview/                    Sample receipt PDF, both emails, .ics (npm run preview)
└── assets/                     Icons, OG image + 11 portfolio screenshots
```

## 2. The booking system — how it works

1. Visitor picks **service → date → 30-min slot (09:00–17:30 PKT, Sundays closed)** → details.
2. `POST /api/book` validates everything server-side, locks the slot (if Vercel KV is
   configured), generates a **branded PDF receipt** + **.ics calendar invite**, then sends:
   - **Customer email** — confirmation + receipt PDF + calendar invite
   - **Owner email** (`usamaabubakr45@gmail.com`) — full booking details + notes + receipt
3. Both emails are 100% in-house HTML with your embedded logo — **zero third-party
   watermarks** ("sent via…", "powered by…" impossible by design).
4. Sending uses **your Gmail via SMTP App Password** on Vercel's free tier ($0).

Config lives in `lib/config.js` (services, durations, prices, hours, closed days, TZ).
Set a `price` on any service and the receipt switches from "FREE" to a priced invoice line.

## 3. Deploy to Vercel (free) — step by step

1. **Gmail App Password** (one-time): Google Account → Security → enable 2-Step
   Verification → App passwords → create one → copy the 16 chars.
2. Push this folder to a GitHub repo (or use Vercel CLI: `npm i -g vercel && vercel`).
3. In Vercel: **Add New → Project → import the repo**. Framework: *Other*. It auto-detects
   `api/book.js` as a serverless function. Deploy.
4. Set env vars (Project → Settings → Environment Variables), see `.env.example`:
   `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OWNER_EMAIL`.
5. **Optional but recommended — double-booking lock:** Project → Storage → Create
   Database → **KV (Upstash)**. Vercel auto-adds `KV_REST_API_URL/TOKEN`. Redeploy.
   (Without it bookings still work; simultaneous-slot protection is simply off.)
6. Test: book a slot → check both inboxes for the branded emails + PDF + invite. 🎉

If the site is hosted elsewhere and only the API on Vercel, add before `js/booking.js`:
`<script>window.BOOKING_API_URL = "https://YOUR-VERCEL-APP.vercel.app/api/book";</script>`

## 4. Post-deploy checklist (2 minutes)

Search & replace the placeholder `https://kraken-code.example.com` with your live domain in:
`index.html` (canonical/OG tags), `robots.txt`, `sitemap.xml`.

## 5. Local development & tests

```bash
npm install          # server deps
npm test             # 9 offline API tests (validation, slots, Sundays, honeypot…)
npm run preview      # regenerate preview/receipt-sample.pdf + both sample emails
python3 -m http.server 8080   # browse the site (booking POST needs the deployed API)
```

Without Gmail creds set, the API runs in **dev mode**: it returns the email HTML as
`preview` in the response instead of sending — handy for debugging.

## 6. Future: WordPress

Static site by design (fast, secure, free). If a WordPress theme is ever required, it can
be generated from this same design; the booking API stays exactly as-is.

---
© 2026 Kraken Code. All rights reserved.
