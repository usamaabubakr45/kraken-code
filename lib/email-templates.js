/* =====================================================================
   KRAKEN CODE — BRANDED EMAIL TEMPLATES + iCal
   100% in-house HTML (table-based, inline CSS). No third-party watermarks.
   Logo is embedded via CID (cid:krakenlogo) — no external hosting needed.
   ===================================================================== */
const { CONFIG, fmtDateLong, fmtMoney } = require('./config');

const B = CONFIG.BRAND;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shell(inner, prehead) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-body-reformat">
<title>${esc(prehead)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(prehead)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f9;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(23,25,35,.08);">
        <!-- HEADER -->
        <tr><td style="background:#0b0e16;padding:26px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;">
              <img src="cid:krakenlogo" width="46" height="46" alt="Kraken Code" style="display:inline-block;border:0;border-radius:10px;vertical-align:middle;">
              <span style="vertical-align:middle;color:#ffffff;font-size:21px;font-weight:bold;letter-spacing:.5px;margin-left:12px;">KRAKEN CODE</span>
            </td>
            <td align="right" style="vertical-align:middle;color:#a78bfa;font-size:11px;letter-spacing:1.5px;font-weight:bold;">BOOKING CONFIRMATION</td>
          </tr></table>
        </td></tr>
        <tr><td style="height:4px;background:linear-gradient(90deg,#a855f7,#6366f1,#3b82f6);font-size:0;line-height:0;">&nbsp;</td></tr>
        <!-- BODY -->
        <tr><td style="padding:34px 36px 28px;">
          ${inner}
        </td></tr>
        <!-- FOOTER -->
        <tr><td style="background:#0b0e16;padding:22px 36px;">
          <div style="color:#c3c7d1;font-size:12px;line-height:1.7;">
            <strong style="color:#ffffff;">${esc(B.name)}</strong> — ${esc(B.tagline)}<br>
            ${esc(B.email)} &nbsp;•&nbsp; © ${new Date().getFullYear()} ${esc(B.name)}. All rights reserved.
          </div>
          <div style="color:#6b7080;font-size:10.5px;margin-top:10px;line-height:1.6;">
            You received this email because an appointment was booked with ${esc(B.name)}.
            Questions? Simply reply to this email — it reaches ${esc(B.founder)} directly.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function rowsTable(pairs) {
  const tr = pairs.map(([k, v]) => `
    <tr>
      <td style="padding:9px 14px;background:#f7f6fc;color:#5b5f6b;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.6px;width:150px;border-bottom:1px solid #eceaf6;">${esc(k)}</td>
      <td style="padding:9px 14px;color:#191b23;font-size:13.5px;border-bottom:1px solid #eceaf6;">${v}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceaf6;border-radius:10px;overflow:hidden;margin:22px 0;">${tr}</table>`;
}

function bulletList(items) {
  return items.map(t => `
    <tr><td style="padding:5px 0;color:#3c404b;font-size:13px;line-height:1.55;">
      <span style="color:#7942f6;font-weight:bold;margin-right:8px;">✓</span>${esc(t)}
    </td></tr>`).join('');
}

function statusChip() {
  return `<span style="display:inline-block;background:#059669;color:#ffffff;font-size:10.5px;font-weight:bold;letter-spacing:1px;padding:5px 12px;border-radius:999px;">CONFIRMED</span>`;
}

function bookingPairs(b, extra) {
  const pairs = [
    ['Service', `<strong>${esc(b.service.title)}</strong>`],
    ['Date', esc(fmtDateLong(b.date))],
    ['Time', `<strong>${esc(b.time)} – ${esc(b.endTime)}</strong> &nbsp;<span style="color:#8a8e99;font-size:12px;">(${esc(CONFIG.TZ)})</span>`],
    ['Duration', `${b.service.duration} minutes · Online call`],
    ['Reference', `<span style="font-family:monospace;background:#f2effc;color:#6d28d9;padding:2px 8px;border-radius:6px;font-weight:bold;">${esc(b.ref)}</span>`],
    ['Fee', esc(fmtMoney(b.service.price)) + (b.service.price === null ? ' <span style="color:#8a8e99;font-size:12px;">(quote follows after discovery)</span>' : '')],
  ];
  return pairs.concat(extra || []);
}

/* ---------------- CUSTOMER EMAIL ---------------- */
function customerEmailHtml(b) {
  const inner = `
    <div style="color:#059669;margin-bottom:14px;">${statusChip()}</div>
    <h1 style="margin:0 0 10px;color:#14161f;font-size:25px;line-height:1.25;">Your appointment is confirmed, ${esc(b.name.split(' ')[0])} 🎉</h1>
    <p style="margin:0;color:#4b4f5a;font-size:14px;line-height:1.65;">
      Thank you for booking with <strong>${esc(B.name)}</strong>. Your slot is reserved and
      <strong>${esc(B.founder)}</strong> has been notified personally. Your stylish receipt
      <strong>(PDF)</strong> and a calendar invite <strong>(.ics)</strong> are attached to this email.
    </p>
    ${rowsTable(bookingPairs(b))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;">
      ${bulletList([
        'A meeting invite with the call link arrives within 2 hours.',
        'Your notes (if any) are reviewed before the call — no prep needed.',
        'Need to reschedule? Reply to this email at least 24 hours ahead.',
      ])}
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
      <tr><td style="background:#7942f6;border-radius:10px;">
        <a href="mailto:${esc(B.email)}?subject=Re:%20${encodeURIComponent(b.ref)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Reply to ${esc(B.founder).split(' ')[0]} →</a>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;color:#8a8e99;font-size:12px;line-height:1.6;">
      Keep the attached PDF receipt for your records — it carries your booking reference
      <strong style="color:#6d28d9;">${esc(b.ref)}</strong>.
    </p>`;
  return shell(inner, `Appointment confirmed — ${b.service.title} on ${fmtDateLong(b.date)} at ${b.time} (${CONFIG.TZ})`);
}

/* ---------------- OWNER / ADMIN EMAIL ---------------- */
function ownerEmailHtml(b, meta) {
  const inner = `
    <h1 style="margin:0 0 10px;color:#14161f;font-size:24px;line-height:1.25;">🔔 New appointment booked</h1>
    <p style="margin:0;color:#4b4f5a;font-size:14px;line-height:1.65;">
      A new consultation was just reserved through the website. The client has already
      received their confirmation, receipt PDF and calendar invite.
    </p>
    ${rowsTable(bookingPairs(b, [
      ['Client', `<strong>${esc(b.name)}</strong>`],
      ['Client email', `<a href="mailto:${esc(b.email)}" style="color:#6d28d9;font-weight:bold;text-decoration:none;">${esc(b.email)}</a>`],
      ['Phone', esc(b.phone || '—')],
      ['Company', esc(b.company || '—')],
    ]))}
    ${b.notes ? `
    <div style="background:#f7f6fc;border-left:4px solid #7942f6;border-radius:0 10px 10px 0;padding:14px 16px;margin:4px 0 18px;">
      <div style="color:#5b5f6b;font-size:11px;font-weight:bold;letter-spacing:.8px;margin-bottom:6px;">CLIENT NOTES</div>
      <div style="color:#2b2e38;font-size:13px;line-height:1.6;">${esc(b.notes)}</div>
    </div>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
      <tr><td style="background:#0b0e16;border-radius:10px;">
        <a href="mailto:${esc(b.email)}?subject=Re:%20${encodeURIComponent(b.ref)}%20—%20Your%20Kraken%20Code%20appointment" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Reply to client →</a>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;color:#8a8e99;font-size:11.5px;line-height:1.6;">
      Slot double-booking protection: <strong style="color:${meta && meta.kvActive ? '#059669' : '#b45309'};">${meta && meta.kvActive ? 'ACTIVE (Vercel KV)' : 'inactive — add Vercel KV storage to enable'}</strong>.
      The client's receipt PDF is attached for your records as well.
    </p>`;
  return shell(inner, `New booking ${b.ref} — ${b.service.title}, ${fmtDateLong(b.date)} ${b.time}`);
}

/* ---------------- iCal ---------------- */
function icsStamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
function makeIcs(b, startUtc, endUtc) {
  const L = [];
  L.push('BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kraken Code//Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH');
  L.push('BEGIN:VEVENT');
  L.push(`UID:${b.ref}@krakencode.booking`);
  L.push(`DTSTAMP:${icsStamp(new Date())}`);
  L.push(`DTSTART:${icsStamp(startUtc)}`);
  L.push(`DTEND:${icsStamp(endUtc)}`);
  L.push(`SUMMARY:Kraken Code — ${b.service.title} (${b.ref})`);
  L.push(`DESCRIPTION:Consultation with ${B.founder}. Reference ${b.ref}. Call link follows by email.`);
  L.push('LOCATION:Online call (link to follow)');
  L.push('BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Kraken Code appointment in 1 hour', 'END:VALARM');
  L.push('END:VEVENT', 'END:VCALENDAR');
  return L.join('\r\n');
}

module.exports = { customerEmailHtml, ownerEmailHtml, makeIcs };
