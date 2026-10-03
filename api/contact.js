/* =====================================================================
   KRAKEN CODE — CONTACT / PROJECT-REQUEST API  v1.0
   POST /api/contact → branded inquiry email to the owner + a branded
   acknowledgement to the visitor. Zero third-party watermarks.

   Same relay-first delivery as /api/book:
     1) Google Apps Script relay (APPS_SCRIPT_URL)  → seconds
     2) Gmail SMTP fallback (GMAIL_USER / GMAIL_APP_PASSWORD)
     3) jsonTransport preview when neither is configured (dev mode)
   ===================================================================== */
const nodemailer = require('nodemailer');
const { CONFIG } = require('../lib/config');
const { LOGO_PNG_BASE64 } = require('../lib/logo-base64');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function nl2br(s) { return esc(s).replace(/\r?\n/g, '<br>'); }

function shell(banner, inner) {
  return `<!doctype html><html><body style="margin:0;background:#0b0e1a;padding:24px 0;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;background:#12172b;border:1px solid #2a3152;border-radius:16px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#6d28d9,#8b5cf6);padding:22px 28px;text-align:center;">
    <img src="cid:krakenlogo" alt="Kraken Code" width="72" style="width:72px;height:auto;border:0;display:inline-block;">
    <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:2px;margin-top:8px;">KRAKEN CODE</div>
    <div style="color:#e9d5ff;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">${esc(banner)}</div>
  </div>
  <div style="padding:26px 30px;color:#e5e7eb;font-size:14px;line-height:1.65;">
    ${inner}
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #2a3152;color:#9ca3af;font-size:12px;">
      ${esc(CONFIG.BRAND.founder)} &middot; ${esc(CONFIG.BRAND.email)}<br>${esc(CONFIG.BRAND.tagline)}
    </div>
  </div>
</div></body></html>`;
}

function rows(pairs) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0;">' +
    pairs.map(([k, v]) =>
      `<tr><td style="padding:7px 14px 7px 0;color:#a5b4fc;font-size:11px;text-transform:uppercase;letter-spacing:1px;white-space:nowrap;vertical-align:top;">${esc(k)}</td>` +
      `<td style="padding:7px 0;color:#f3f4f6;font-size:14px;">${v}</td></tr>`).join('') +
    '</table>';
}

function ownerHtml(p) {
  return shell('New Project Request', `
    <p style="margin:0 0 6px;">A new project request arrived from the website:</p>
    ${rows([
      ['Name', esc(p.name)],
      ['Email', `<a href="mailto:${esc(p.email)}" style="color:#c4b5fd;">${esc(p.email)}</a>`],
      ['Service', esc(p.service)],
      ['Received', esc(p.received)],
      ['Reference', `<strong style="color:#c4b5fd;">${esc(p.ref)}</strong>`],
    ])}
    <div style="background:#1b2138;border:1px solid #2a3152;border-radius:10px;padding:14px 16px;margin-top:6px;">
      <div style="color:#a5b4fc;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Project scope / goals</div>
      <div style="color:#f3f4f6;">${nl2br(p.message)}</div>
    </div>
    <p style="margin-top:16px;color:#9ca3af;font-size:13px;">Reply directly to this email to answer ${esc(p.name)} — the reply-to address is theirs.</p>`);
}

function ackHtml(p) {
  return shell('Request Received', `
    <p style="margin:0 0 6px;">Hi ${esc(p.name)},</p>
    <p>Thank you for reaching out to Kraken Code. Your project request has been received and landed directly in ${esc(CONFIG.BRAND.founder)}'s inbox.</p>
    ${rows([
      ['Service', esc(p.service)],
      ['Received', esc(p.received)],
      ['Reference', `<strong style="color:#c4b5fd;">${esc(p.ref)}</strong>`],
    ])}
    <p style="margin-top:14px;"><strong style="color:#c4b5fd;">What happens next:</strong> ${esc(CONFIG.BRAND.founder)} personally reviews every request and replies within 2 business hours (usually much faster).</p>
    <p style="color:#9ca3af;font-size:13px;">In a hurry? Book a call directly from the website and pick a slot that suits you.</p>`);
}

/* ---------------- delivery (mirror of book.js, relay-first) ---------------- */
async function sendViaRelay(msg) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(msg),
      signal: ctrl.signal,
      redirect: 'follow',
    });
    const txt = await res.text();
    let data = {};
    try { data = JSON.parse(txt); } catch (e) { /* error page etc. */ }
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
      { filename: 'krakenlogo.png', content: Buffer.from(msg.inlineImages[0].base64, 'base64'), cid: 'krakenlogo' },
    ],
  });
  return { messageId: info.messageId, response: info.response };
}

async function sendEmail(payload, label) {
  const useRelay = !!process.env.APPS_SCRIPT_URL;
  const useSmtp = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  if (!useRelay && !useSmtp) {
    const t = nodemailer.createTransport({ jsonTransport: true });
    const info = await t.sendMail({ from: payload.from, to: payload.to, subject: payload.subject, html: payload.html });
    console.log(`CONTACT_OK ${label} channel=dev to=${payload.to} msgId=${info.messageId}`);
    return { ok: true, channel: 'dev' };
  }
  const transport = useSmtp ? smtpTransport() : null;
  const attempts = [];
  if (useRelay) attempts.push(['relay', () => sendViaRelay(payload)]);
  if (useSmtp) attempts.push(['smtp', () => sendViaSmtp(transport, payload)]);
  for (let round = 0; round < 2; round++) {
    for (const [channel, fn] of attempts) {
      try {
        const info = await fn();
        console.log(`CONTACT_OK ${label} channel=${channel} to=${payload.to} msgId=${info.messageId}`);
        return { ok: true, channel };
      } catch (e) {
        console.log(`CONTACT_FAIL ${label} channel=${channel} round=${round} err=${e.message}`);
      }
    }
    if (round === 0) await new Promise((r) => setTimeout(r, 1200));
  }
  return { ok: false, channel: 'failed' };
}

function makeContactRef(d = new Date()) {
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ123456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `PR-${y}${m}${day}-${s}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (body.leave_empty || body.website) return res.status(200).json({ ok: true, ref: 'PR-SPAM-0000' }); // honeypot

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const service = String(body.service || '').trim() || 'General Inquiry';
  const message = String(body.message || '').trim() || '—';

  const errors = [];
  if (name.length < 2) errors.push('name: required');
  if (!EMAIL_RE.test(email)) errors.push('email: invalid address');
  if (errors.length) return res.status(400).json({ ok: false, errors });

  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER || CONFIG.BRAND.email;
  const ref = makeContactRef();
  const received = new Date().toLocaleString('en-GB', { timeZone: CONFIG.TZ || 'America/New_York', hour12: true });
  const fromAddr = `"Kraken Code" <${process.env.GMAIL_USER || CONFIG.BRAND.email}>`;
  const payload = { name, email, service, message, ref, received };
  const inline = [{ name: 'krakenlogo', base64: LOGO_PNG_BASE64, contentType: 'image/png' }];

  const mail = { owner: false, customer: false, channel: 'none' };

  const ownerMsg = {
    secret: process.env.APPS_SCRIPT_SECRET, to: ownerEmail,
    subject: `New Project Request — ${service} [${ref}]`,
    html: ownerHtml(payload), from: fromAddr, fromName: 'Kraken Code', replyTo: email,
    attachments: [], inlineImages: inline,
  };
  const r1 = await sendEmail(ownerMsg, 'owner');
  mail.owner = r1.ok; if (r1.ok) mail.channel = r1.channel;

  const custMsg = {
    secret: process.env.APPS_SCRIPT_SECRET, to: email,
    subject: `We received your project request [${ref}] — Kraken Code`,
    html: ackHtml(payload), from: fromAddr, fromName: 'Kraken Code', replyTo: ownerEmail,
    attachments: [], inlineImages: inline,
  };
  const r2 = await sendEmail(custMsg, 'customer');
  mail.customer = r2.ok; if (r2.ok && mail.channel === 'none') mail.channel = r2.channel;

  const devMode = mail.channel === 'dev';
  return res.status(200).json({
    ok: true, ref, devMode, mail,
    message: mail.owner && mail.customer
      ? 'Request delivered to Usama and acknowledgement sent to you.'
      : 'Request recorded, but some emails could not be sent — please also email directly.',
  });
};
