/* Local test harness for the booking API (no network, no creds needed). */
const assert = require('assert');
process.env.KV_REST_API_URL = '';   // ensure KV off
process.env.KV_REST_API_TOKEN = '';

const handler = require('../api/book.js');
const { todayInTz, weekdayOfDateStr } = require('../lib/config');

function mkRes() {
  return {
    code: null, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
function nextWeekday(notDay) { // first date >= today+1 whose weekday != notDay
  let d = addDays(todayInTz(), 1);
  for (let i = 0; i < 10; i++) { if (weekdayOfDateStr(d) !== notDay) return d; d = addDays(d, 1); }
  return d;
}

(async () => {
  let pass = 0;
  const t = async (name, fn) => { await fn(); pass++; console.log('  ✔', name); };

  console.log('Booking API tests:');

  await t('GET availability returns slots', async () => {
    const res = mkRes();
    await handler({ method: 'GET', url: `/api/book?date=${nextWeekday(0)}` }, res);
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.slots.length, 18);
    assert.strictEqual(res.body.closed, false);
  });

  await t('GET rejects bad date', async () => {
    const res = mkRes();
    await handler({ method: 'GET', url: '/api/book?date=nope' }, res);
    assert.strictEqual(res.code, 400);
  });

  await t('GET marks Sunday closed', async () => {
    let d = addDays(todayInTz(), 1);
    while (weekdayOfDateStr(d) !== 0) d = addDays(d, 1);
    const res = mkRes();
    await handler({ method: 'GET', url: `/api/book?date=${d}` }, res);
    assert.strictEqual(res.body.closed, true);
  });

  await t('POST rejects missing fields', async () => {
    const res = mkRes();
    await handler({ method: 'POST', url: '/api/book', body: { service: 'landing-pages' } }, res);
    assert.strictEqual(res.code, 400);
    assert(res.body.errors.length >= 3);
  });

  await t('POST rejects unknown service', async () => {
    const res = mkRes();
    await handler({ method: 'POST', url: '/api/book', body: { service: 'hacking', name: 'A B', email: 'a@b.co', date: nextWeekday(0), time: '10:00' } }, res);
    assert.strictEqual(res.code, 400);
  });

  await t('POST rejects Sunday', async () => {
    let d = addDays(todayInTz(), 1);
    while (weekdayOfDateStr(d) !== 0) d = addDays(d, 1);
    const res = mkRes();
    await handler({ method: 'POST', url: '/api/book', body: { service: 'landing-pages', name: 'A B', email: 'a@b.co', date: d, time: '10:00' } }, res);
    assert.strictEqual(res.code, 400);
  });

  await t('POST rejects past slot (2h lead)', async () => {
    const res = mkRes();
    await handler({ method: 'POST', url: '/api/book', body: { service: 'landing-pages', name: 'A B', email: 'a@b.co', date: todayInTz(), time: '00:00' } }, res);
    assert.strictEqual(res.code, 400);
  });

  await t('POST valid booking → 200 + ref + devMode preview', async () => {
    const res = mkRes();
    await handler({
      method: 'POST', url: '/api/book',
      body: { service: 'custom-website-design', date: nextWeekday(0), time: '11:00', name: 'Test Client', email: 'client@example.com', phone: '+92 300 1234567', company: 'Example Co', notes: 'Need a portfolio site.' },
    }, res);
    assert.strictEqual(res.code, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.ok, true);
    assert(/^KC-\d{6}-[A-Z2-9]{4}$/.test(res.body.ref));
    assert.strictEqual(res.body.devMode, true);
    assert(res.body.preview.customer.includes('confirmed'));
    assert(res.body.preview.owner.includes('New appointment booked'));
    const low = (res.body.preview.customer + res.body.preview.owner).toLowerCase();
    assert(!low.includes('sent via') && !low.includes('powered by') && !low.includes('mailchimp'), 'watermark check');
    global.__LAST = res.body;
  });

  await t('honeypot silently accepts spam', async () => {
    const res = mkRes();
    await handler({ method: 'POST', url: '/api/book', body: { website: 'spam', service: 'x' } }, res);
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.body.ref, 'KC-SPAM-0000');
  });

  console.log(`\n${pass} tests passed ✅  (last ref: ${global.__LAST.ref})`);
})().catch(e => { console.error('TEST FAILED:', e.message); process.exit(1); });
