/* =====================================================================
   KRAKEN CODE — BOOKING CONFIG (server source of truth)
   Edit services, hours, prices here. Front-end mirrors service cards.
   ===================================================================== */

const SERVICES = [
  { slug: 'custom-website-design',  title: 'Custom Website Design',        duration: 30, price: null },
  { slug: 'ecommerce-development',  title: 'E-Commerce Development',       duration: 30, price: null },
  { slug: 'cms-development',        title: 'CMS Development',              duration: 30, price: null },
  { slug: 'landing-pages',          title: 'Landing Pages',                duration: 30, price: null },
  { slug: 'maintenance-support',    title: 'Website Maintenance & Support', duration: 30, price: null },
];

const CONFIG = {
  SERVICES,
  TZ: process.env.BOOKING_TZ || 'America/New_York',
  TZ_LABEL: process.env.BOOKING_TZ_LABEL || 'US Eastern Time (ET)',
  DAY_OPEN: 9,          // 09:00 first slot
  DAY_CLOSE: 18,        // 18:00 last bookable end → last slot 17:30
  SLOT_MIN: 30,
  MIN_LEAD_HOURS: 2,    // can't book less than 2h ahead
  MAX_AHEAD_DAYS: 60,
  CLOSED_WEEKDAYS: [0], // 0 = Sunday (in booking TZ)
  CURRENCY: 'USD',
  BRAND: {
    name: 'Kraken Code',
    founder: 'Usama Abu Bakr',
    tagline: 'AI Implementation • AI Web Development • AI Lead-Gen Engines',
    email: 'usamaabubakr45@gmail.com',
    line: 'High-converting, modern digital experiences.',
  },
};

/* ---------- helpers ---------- */

function slotsForDay() {
  const out = [];
  for (let m = CONFIG.DAY_OPEN * 60; m + CONFIG.SLOT_MIN <= CONFIG.DAY_CLOSE * 60; m += CONFIG.SLOT_MIN) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

// wall-clock parts (y,m,d,hh,mm,ss) of a timestamp inside CONFIG.TZ
function tzParts(ts) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: CONFIG.TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(ts))) p[type] = value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: p.hour === '24' ? 0 : +p.hour, mi: +p.minute, s: +p.second };
}

function todayInTz() {
  const p = tzParts(Date.now());
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

function nowPartsInTz() { return tzParts(Date.now()); }

function weekdayOfDateStr(dateStr) { // 0=Sun … safe: noon UTC = same calendar day in any TZ ±14
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

// convert "YYYY-MM-DD HH:MM" wall time in CONFIG.TZ → UTC Date (iterative offset solve)
function zonedToUtc(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi, 0);
  let ts = target;
  for (let i = 0; i < 3; i++) {
    const p = tzParts(ts);
    const wall = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    ts += target - wall;
  }
  return new Date(ts);
}

function fmtMoney(amount) {
  if (amount === null || amount === undefined) return 'FREE';
  return `${CONFIG.CURRENCY} ${Number(amount).toFixed(2)}`;
}

function fmtDateLong(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
    .toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function makeRef(dateStr) {
  const ymd = dateStr.replace(/-/g, '').slice(2);
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 4; i++) r += abc[Math.floor(Math.random() * abc.length)];
  return `KC-${ymd}-${r}`;
}

module.exports = { CONFIG, slotsForDay, todayInTz, nowPartsInTz, weekdayOfDateStr, zonedToUtc, fmtMoney, fmtDateLong, makeRef, tzParts };
