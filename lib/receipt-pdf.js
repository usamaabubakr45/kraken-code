/* =====================================================================
   KRAKEN CODE — STYLISH PDF RECEIPT (pdf-lib, 100% in-house, no watermarks)
   ===================================================================== */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { CONFIG, fmtMoney, fmtDateLong } = require('./config');

const DARK = rgb(0.043, 0.055, 0.086);
const PURPLE = rgb(0.474, 0.259, 0.965);
const PURPLE_SOFT = rgb(0.94, 0.93, 0.99);
const INK = rgb(0.10, 0.11, 0.16);
const GREY = rgb(0.42, 0.45, 0.52);
const LIGHT = rgb(0.96, 0.965, 0.98);
const GREEN = rgb(0.02, 0.59, 0.41);
const WHITE = rgb(1, 1, 1);

function wrap(font, text, size, maxW) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

async function buildReceiptPdf(b) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const H = 841.89;
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const W = 595.28, M = 42, RW = W - M * 2;

  /* ---- header band ---- */
  page.drawRectangle({ x: 0, y: H - 148, width: W, height: 148, color: DARK });
  // logo tile + trident mark
  const tx = 42, ty = H - 42, ts = 62;
  page.drawRectangle({ x: tx, y: ty - ts, width: ts, height: ts, color: PURPLE });
  const lw = 4.2, cx = tx + ts / 2;
  const seg = (x1, y1, x2, y2) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: lw, color: WHITE, lineCap: 2 });
  const s = ts / 24;
  seg(cx, ty - 4.5 * s, cx, ty - 19.5 * s);
  seg(tx + 6.5 * s, ty - 8 * s, cx, ty - 12 * s); seg(cx, ty - 12 * s, tx + 17.5 * s, ty - 8 * s);
  seg(tx + 6.5 * s, ty - 13.5 * s, cx, ty - 17.5 * s); seg(cx, ty - 17.5 * s, tx + 17.5 * s, ty - 13.5 * s);
  page.drawCircle({ x: cx, y: ty - 5.6 * s, size: 2.4, color: WHITE });

  page.drawText(CONFIG.BRAND.name.toUpperCase(), { x: 122, y: H - 74, size: 25, font: bold, color: WHITE });
  page.drawText(CONFIG.BRAND.tagline, { x: 122, y: H - 92, size: 9, font: reg, color: rgb(0.62, 0.65, 0.72) });
  page.drawText('BOOKING CONFIRMATION & RECEIPT', { x: W - M - bold.widthOfTextAtSize('BOOKING CONFIRMATION & RECEIPT', 12), y: H - 62, size: 12, font: bold, color: rgb(0.78, 0.62, 0.99) });
  page.drawText(`Ref: ${b.ref}`, { x: W - M - reg.widthOfTextAtSize(`Ref: ${b.ref}`, 10), y: H - 80, size: 10, font: reg, color: WHITE });
  page.drawText(`Issued: ${fmtDateLong(b.createdAt.slice(0, 10))}`, { x: W - M - reg.widthOfTextAtSize(`Issued: ${fmtDateLong(b.createdAt.slice(0, 10))}`, 8.5), y: H - 95, size: 8.5, font: reg, color: rgb(0.62, 0.65, 0.72) });
  page.drawRectangle({ x: 0, y: H - 152, width: W, height: 4, color: PURPLE });

  /* ---- prepared for / booking details ---- */
  let y = H - 196;
  page.drawText('PREPARED FOR', { x: M, y, size: 8.5, font: bold, color: GREY });
  page.drawText(b.name, { x: M, y: y - 18, size: 13, font: bold, color: INK });
  let ly = y - 34;
  for (const line of [b.email, b.phone || null, b.company || null].filter(Boolean)) {
    page.drawText(line, { x: M, y: ly, size: 9.5, font: reg, color: GREY }); ly -= 14;
  }

  const rx = 320;
  page.drawText('BOOKING DETAILS', { x: rx, y, size: 8.5, font: bold, color: GREY });
  page.drawText(b.service.title, { x: rx, y: y - 18, size: 13, font: bold, color: INK });
  page.drawText(fmtDateLong(b.date), { x: rx, y: y - 34, size: 9.5, font: reg, color: GREY });
  page.drawText(`${b.time} – ${b.endTime}  (${CONFIG.TZ})`, { x: rx, y: y - 48, size: 9.5, font: reg, color: GREY });
  page.drawText(`Duration: ${b.service.duration} minutes  •  Format: Online call`, { x: rx, y: y - 62, size: 9.5, font: reg, color: GREY });
  // status chip
  page.drawRectangle({ x: rx, y: y - 88, width: 92, height: 18, color: GREEN });
  page.drawText('CONFIRMED', { x: rx + 12, y: y - 83, size: 8.5, font: bold, color: WHITE });

  /* ---- line items table ---- */
  y = y - 116;
  page.drawRectangle({ x: M, y: y - 6, width: RW, height: 26, color: PURPLE_SOFT });
  page.drawText('DESCRIPTION', { x: M + 10, y, size: 8.5, font: bold, color: PURPLE });
  page.drawText('DURATION', { x: 400, y, size: 8.5, font: bold, color: PURPLE });
  page.drawText('AMOUNT', { x: W - M - 10 - reg.widthOfTextAtSize('AMOUNT', 8.5), y, size: 8.5, font: bold, color: PURPLE });

  y -= 26;
  const descLines = wrap(reg, `${b.service.title} — strategy & scope consultation with ${CONFIG.BRAND.founder}.`, 9.5, 320);
  descLines.forEach((ln, i) => page.drawText(ln, { x: M + 10, y: y - 14 - i * 13, size: 9.5, font: reg, color: INK }));
  if (b.notes) {
    const noteLines = wrap(reg, `Client notes: ${b.notes}`, 8.5, 320).slice(0, 3);
    noteLines.forEach((ln, i) => page.drawText(ln, { x: M + 10, y: y - 14 - descLines.length * 13 - 4 - i * 11, size: 8.5, font: reg, color: GREY }));
  }
  page.drawText(`${b.service.duration} min`, { x: 400, y: y - 14, size: 9.5, font: reg, color: INK });
  const amt = fmtMoney(b.service.price);
  page.drawText(amt, { x: W - M - 10 - reg.widthOfTextAtSize(amt, 9.5), y: y - 14, size: 9.5, font: reg, color: INK });

  const tableBottom = y - 14 - descLines.length * 13 - (b.notes ? 40 : 8);
  page.drawLine({ start: { x: M, y: tableBottom }, end: { x: W - M, y: tableBottom }, thickness: 1, color: LIGHT });

  /* ---- total band ---- */
  const tb = tableBottom - 40;
  page.drawRectangle({ x: M, y: tb, width: RW, height: 34, color: DARK });
  page.drawText('TOTAL DUE TODAY', { x: M + 12, y: tb + 13, size: 10, font: bold, color: WHITE });
  const totalTxt = b.service.price === null ? 'FREE — no payment required' : fmtMoney(b.service.price);
  page.drawText(totalTxt, { x: W - M - 12 - bold.widthOfTextAtSize(totalTxt, 11), y: tb + 12, size: 11, font: bold, color: rgb(0.72, 0.88, 0.8) });

  /* ---- next steps + terms ---- */
  let ny = tb - 28;
  page.drawText('WHAT HAPPENS NEXT', { x: M, y: ny, size: 8.5, font: bold, color: GREY });
  const steps = [
    `1.  You receive this confirmation by email (keep it for your records).`,
    `2.  A meeting invite with the call link follows within 2 hours of your booking.`,
    `3.  ${CONFIG.BRAND.founder} reviews your notes before the call — no prep needed on your side.`,
  ];
  steps.forEach((ln, i) => page.drawText(ln, { x: M, y: ny - 16 - i * 14, size: 9.5, font: reg, color: INK }));
  ny = ny - 16 - steps.length * 14 - 14;
  const terms = wrap(reg, `Reschedule / cancel: reply to your confirmation email at least 24 hours before the slot. Fees: none for consultations — project pricing is quoted separately after discovery. Contact: ${CONFIG.BRAND.email}.`, 8, RW);
  terms.forEach((ln, i) => page.drawText(ln, { x: M, y: ny - i * 11, size: 8, font: reg, color: GREY }));

  /* ---- footer band ---- */
  page.drawRectangle({ x: 0, y: 0, width: W, height: 46, color: DARK });
  page.drawText(`${CONFIG.BRAND.name} — ${CONFIG.BRAND.tagline}`, { x: M, y: 26, size: 8.5, font: reg, color: rgb(0.75, 0.78, 0.85) });
  page.drawText(`${CONFIG.BRAND.email}  •  © ${new Date().getFullYear()} ${CONFIG.BRAND.name}. All rights reserved.`, { x: M, y: 13, size: 8, font: reg, color: rgb(0.55, 0.58, 0.66) });

  return Buffer.from(await doc.save());
}

module.exports = { buildReceiptPdf };
