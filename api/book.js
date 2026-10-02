/* =====================================================================
   KRAKEN CODE — BOOKING API (Vercel serverless function)
   POST /api/book  → create booking, send BOTH emails + PDF receipt + .ics
   GET  /api/book?date=YYYY-MM-DD → { booked: ["09:00",...], closed: bool }

   Env vars (Vercel → Project → Settings → Environment Variables):
     GMAIL_USER          usamaabubakr45@gmail.com
     GMAIL_APP_PASSWORD  xxxx xxxx xxxx xxxx   (Google App Password)
     OWNER_EMAIL         (optional, defaults to GMAIL_USER)
     ALLOW_ORIGIN        (optional, your site origin; default *)
   Optional (auto-added when you create Vercel KV storage):
     KV_REST_API_URL / KV_REST_API_TOKEN  → enables double-booking lock
   ===================================================================== */
const path = require('path');
const nodemailer = require('nodemailer');
const { CONFIG, slotsForDay, todayInTz, weekdayOfDateStr, zonedToUtc, makeRef, tzParts } = require('../lib/config');
const { buildReceiptPdf } = require('../lib/receipt-pdf');
const { customerEmailHtml, ownerEmailHtml, makeIcs } = require('../lib/email-templates');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function getRedis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { Redis } = require('@upstash/redis');
    return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  } catch (e) { console.error('KV init failed:', e.message); return null; }
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function endTimeOf(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function validate(body) {
  const errs = [];
  const service = CONFIG.SERVICES.find(s => s.slug === (body.service || '').trim());
  if (!service) errs.push('service: choose one of the listed services');
  if (!body.name || String(body.name).trim().length < 2) errs.push('name: required');
  if (!EMAIL_RE.test(String(body.email || '').trim())) errs.push('email: invalid address');

  const date = String(body.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.push('date: use YYYY-MM-DD');
  else {
    const today = todayInTz();
    if (date < today) errs.push('date: cannot be in the past');
    if (date > addDays(today, CONFIG.MAX_AHEAD_DAYS)) errs.push(`date: book at most ${CONFIG.MAX_AHEAD_DAYS} days ahead`);
    if (CONFIG.CLOSED_WEEKDAYS.includes(weekdayOfDateStr(date))) errs.push('date: closed on Sundays — pick another day');
  }

  const time = String(body.time || '').trim();
  if (!slotsForDay().includes(time)) errs.push('time: pick an available slot');
  else if (service && /^\d{4}-\d{2}-\d{2}$/.test(date) && !CONFIG.CLOSED_WEEKDAYS.includes(weekdayOfDateStr(date))) {
    const startUtc = zonedToUtc(date, time);
    if (startUtc.getTime() < Date.now() + CONFIG.MIN_LEAD_HOURS * 3600 * 1000) errs.push('time: slot too soon — choose one at least 2h ahead');
  }
  if (body.notes && String(body.notes).length > 1200) errs.push('notes: max 1200 characters');
  return { errs, service };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  /* ---------- GET availability ---------- */
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://local');
    const date = url.searchParams.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ ok: false, error: 'bad date' });
    const closed = CONFIG.CLOSED_WEEKDAYS.includes(weekdayOfDateStr(date));
    let booked = [];
    const redis = await getRedis();
    if (redis && !closed) {
      try { booked = JSON.parse(await redis.get(`kc:day:${date}`)) || []; } catch (e) { booked = []; }
    }
    // hide past slots for today
    let past = [];
    if (date === todayInTz()) {
      const now = Date.now();
      past = slotsForDay().filter(t => zonedToUtc(date, t).getTime() < now + CONFIG.MIN_LEAD_HOURS * 3600 * 1000);
    }
    return res.status(200).json({ ok: true, date, closed, booked, past, slots: slotsForDay(), tz: CONFIG.TZ });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  /* ---------- POST booking ---------- */
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.website) return res.status(200).json({ ok: true, ref: 'KC-SPAM-0000' }); // honeypot: pretend success

    const { errs, service } = validate(body);
    if (errs.length) return res.status(400).json({ ok: false, errors: errs });

    const date = body.date.trim(), time = body.time.trim();
    const ref = makeRef(date);
    const redis = await getRedis();

    // atomic double-booking lock (only when KV configured)
    let kvActive = false;
    if (redis) {
      kvActive = true;
      const held = await redis.set(`kc:slot:${date}:${time}`, ref, { nx: true });
      if (!held) return res.status(409).json({ ok: false, error: 'slot_taken', message: 'That slot was just taken — please pick another time.' });
      try {
        const prev = JSON.parse(await redis.get(`kc:day:${date}`)) || [];
        if (!prev.includes(time)) await redis.set(`kc:day:${date}`, JSON.stringify([...prev, time]));
      } catch (e) { /* non-fatal */ }
    }

    const startUtc = zonedToUtc(date, time);
    const endUtc = new Date(startUtc.getTime() + service.duration * 60000);
    const booking = {
      ref, date, time, endTime: endTimeOf(time, service.duration), tz: CONFIG.TZ,
      service: { slug: service.slug, title: service.title, duration: service.duration, price: service.price },
      name: String(body.name).trim(), email: String(body.email).trim().toLowerCase(),
      phone: String(body.phone || '').trim(), company: String(body.company || '').trim(),
      notes: String(body.notes || '').trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const pdf = await buildReceiptPdf(booking);
    const ics = makeIcs(booking, startUtc, endUtc);
    const logoPath = path.join(__dirname, '..', 'assets', 'icon-192.png');

    const devMode = !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD;
    const transport = devMode
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });

    const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER || CONFIG.BRAND.email;
    const sharedAtt = [
      { filename: `KrakenCode-Receipt-${ref}.pdf`, content: pdf, contentType: 'application/pdf' },
      { filename: `appointment-${ref}.ics`, content: ics, contentType: 'text/calendar; method=PUBLISH' },
    ];

    const msgCustomer = {
      from: `"Kraken Code" <${process.env.GMAIL_USER || CONFIG.BRAND.email}>`,
      to: booking.email,
      subject: `✅ Confirmed: Your Kraken Code appointment (${ref})`,
      html: customerEmailHtml(booking),
      attachments: [{ filename: 'logo.png', path: logoPath, cid: 'krakenlogo' }, ...sharedAtt],
    };
    const msgOwner = {
      from: `"Kraken Code Bookings" <${process.env.GMAIL_USER || CONFIG.BRAND.email}>`,
      to: ownerEmail,
      subject: `🔔 New booking ${ref} — ${service.title} • ${date} ${time} (${CONFIG.TZ})`,
      html: ownerEmailHtml(booking, { kvActive }),
      attachments: [{ filename: 'logo.png', path: logoPath, cid: 'krakenlogo' }, ...sharedAtt],
    };

    const sent = await Promise.all([transport.sendMail(msgCustomer), transport.sendMail(msgOwner)]);

    const out = { ok: true, ref, devMode, kvActive, message: devMode ? 'Booking recorded in dev mode (no Gmail creds set — emails previewed, not sent).' : 'Confirmation emails sent to you and to us.' };
    if (devMode) out.preview = { customer: msgCustomer.html, owner: msgOwner.html };
    if (devMode) console.log(JSON.stringify(sent.map(s => s.message && s.message.length ? { bytes: s.message.length } : s)));
    return res.status(200).json(out);
  } catch (e) {
    console.error('BOOKING ERROR:', e);
    return res.status(500).json({ ok: false, error: 'server_error', message: 'Something went wrong on our side — please try again or email us directly.' });
  }
};
