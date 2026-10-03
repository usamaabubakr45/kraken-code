/* =====================================================================
   KRAKEN CODE — BOOKING API (Vercel serverless function)  v2.2
   POST /api/book  → create booking, send BOTH emails + PDF receipt + .ics
   GET  /api/book?date=YYYY-MM-DD → { booked: ["09:00",...], closed: bool }

   v2.2 — INSTANT DELIVERY: primary channel is the Google Apps Script
   relay (HTTPS → your Gmail sends internally = seconds). Direct Gmail
   SMTP remains as automatic fallback; jsonTransport preview = dev mode.

   Env vars (Vercel → Settings → Environment Variables):
     APPS_SCRIPT_URL      Web-app /exec URL of apps-script/Code.gs  ← primary
     APPS_SCRIPT_SECRET   shared secret (same as in Code.gs)
     GMAIL_USER / GMAIL_APP_PASSWORD   fallback SMTP + sender identity
     OWNER_EMAIL            (optional, defaults to GMAIL_USER)
   Optional: KV_REST_API_URL / KV_REST_API_TOKEN → double-booking lock
   ===================================================================== */
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { CONFIG, slotsForDay, todayInTz, weekdayOfDateStr, zonedToUtc, makeRef } = require('../lib/config');
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

/* ---------- send channels ---------- */

async function sendViaRelay(msg) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script prefers plain body
      body: JSON.stringify(msg),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const txt = await res.text();
    let data = {};
    try { data = JSON.parse(txt); } catch (e) { /* html error page etc. */ }
    if (!data.ok) throw new Error(`relay responded: ${txt.slice(0, 200)}`);
    return { messageId: 'relay', response: 'relay-ok' };
  } finally { clearTimeout(timer); }
}

function smtpTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 45000,
  });
}

async function sendViaSmtp(transport, msg) {
  const info = await transport.sendMail({
    from: msg.from, to: msg.to, subject: msg.subject, html: msg.html,
    attachments: [
      { filename: msg.inlineImages[0].name + '.png', content: Buffer.from(msg.inlineImages[0].base64, 'base64'), cid: msg.inlineImages[0].name },
      ...msg.attachments.map(a => ({ filename: a.filename, content: Buffer.from(a.base64, 'base64'), contentType: a.contentType })),
    ],
  });
  return { messageId: info.messageId, response: info.response };
}

/* retry wrapper: relay first, SMTP fallback, one retry each */
async function sendEmail(payload, label) {
  const useRelay = !!process.env.APPS_SCRIPT_URL;
  const useSmtp = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  const transport = useSmtp ? smtpTransport() : null;

  const attempts = [];
  if (useRelay) attempts.push(['relay', () => sendViaRelay(payload)]);
  if (useSmtp) attempts.push(['smtp', () => sendViaSmtp(transport, payload)]);
  if (!attempts.length) {
    const t = nodemailer.createTransport({ jsonTransport: true });
    attempts.push(['dev', async () => { const i = await t.sendMail({ from: payload.from, to: payload.to, subject: payload.subject, html: payload.html }); return { messageId: i.messageId, response: 'dev' }; }]);
  }

  for (let round = 0; round < 2; round++) {
    for (const [channel, fn] of attempts) {
      try {
        const info = await fn();
        console.log(`MAIL_OK ${label} channel=${channel} to=${payload.to} msgId=${info.messageId} smtp=${info.response || ''}`);
        return { ok: true, channel, messageId: info.messageId };
      } catch (e) {
        console.error(`MAIL_FAIL ${label} channel=${channel} to=${payload.to} attempt=${round + 1} err=${e.message}`);
      }
    }
    if (round === 0) await new Promise(r => setTimeout(r, 1200));
  }
  return { ok: false, error: 'all channels failed' };
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
    if (body.leave_empty || body.website) { console.log('HONEYPOT TRIGGERED value=' + (body.leave_empty || body.website)); return res.status(200).json({ ok: true, ref: 'KC-SPAM-0000' }); } // honeypot: pretend success

    const { errs, service } = validate(body);
    if (errs.length) return res.status(400).json({ ok: false, errors: errs });

    const date = body.date.trim(), time = body.time.trim();
    const ref = makeRef(date);
    const redis = await getRedis();

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

    // logo: file on disk if present, else embedded base64
    let logoB64 = null;
    try {
      const logoPath = path.join(__dirname, '..', 'assets', 'icon-192.png');
      if (fs.existsSync(logoPath)) logoB64 = fs.readFileSync(logoPath).toString('base64');
    } catch (e) { /* ignore */ }
    if (!logoB64) logoB64 = require('../lib/logo-base64.js').LOGO_PNG_BASE64;

    const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER || CONFIG.BRAND.email;
    const fromAddr = `"Kraken Code" <${process.env.GMAIL_USER || CONFIG.BRAND.email}>`;
    const sharedAtt = [
      { filename: `KrakenCode-Receipt-${ref}.pdf`, contentType: 'application/pdf', base64: pdf.toString('base64') },
      { filename: `appointment-${ref}.ics`, contentType: 'text/calendar', base64: Buffer.from(ics, 'utf8').toString('base64') },
    ];
    const inline = [{ name: 'krakenlogo', contentType: 'image/png', base64: logoB64 }];

    const msgCustomer = {
      secret: process.env.APPS_SCRIPT_SECRET || undefined,
      from: fromAddr, fromName: 'Kraken Code', replyTo: ownerEmail,
      to: booking.email,
      subject: `✅ Confirmed: Your Kraken Code appointment (${ref})`,
      html: customerEmailHtml(booking),
      attachments: sharedAtt, inlineImages: inline,
    };
    const msgOwner = {
      secret: process.env.APPS_SCRIPT_SECRET || undefined,
      from: fromAddr, fromName: 'Kraken Code Bookings', replyTo: booking.email,
      to: ownerEmail,
      subject: `🔔 New booking ${ref} — ${service.title} • ${date} ${time} (${CONFIG.TZ})`,
      html: ownerEmailHtml(booking, { kvActive }),
      attachments: sharedAtt, inlineImages: inline,
    };

    // customer first (most important), then owner — sequentially
    const custRes = await sendEmail(msgCustomer, 'customer');
    const ownerRes = await sendEmail(msgOwner, 'owner');

    const devMode = custRes.channel === 'dev';
    const out = {
      ok: true, ref, devMode, kvActive,
      mail: { customer: custRes.ok, owner: ownerRes.ok, channel: custRes.channel || ownerRes.channel },
      message: devMode
        ? 'Booking recorded in dev mode (no mail creds set — emails previewed, not sent).'
        : (custRes.ok && ownerRes.ok)
          ? `Confirmation emails sent via ${custRes.channel} to you and to us.`
          : `Booking saved, but email problem: customer=${custRes.ok ? 'sent' : 'FAILED'}, owner=${ownerRes.ok ? 'sent' : 'FAILED'}`,
    };
    if (devMode) out.preview = { customer: msgCustomer.html, owner: msgOwner.html };
    return res.status(200).json(out);
  } catch (e) {
    console.error('BOOKING ERROR:', e);
    return res.status(500).json({ ok: false, error: 'server_error', message: 'Something went wrong on our side — please try again or email us directly.' });
  }
};
