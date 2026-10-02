/* Generates sample deliverables so you can SEE the emails + receipt before deploying:
   preview/receipt-sample.pdf, email-customer.html, email-owner.html, appointment-sample.ics */
const fs = require('fs');
const path = require('path');
const { buildReceiptPdf } = require('../lib/receipt-pdf');
const { customerEmailHtml, ownerEmailHtml, makeIcs } = require('../lib/email-templates');
const { zonedToUtc, todayInTz } = require('../lib/config');

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

(async () => {
  const date = addDays(todayInTz(), 3);
  const b = {
    ref: 'KC-' + date.replace(/-/g, '').slice(2) + '-DEMO',
    date, time: '11:00', endTime: '11:30', tz: 'Asia/Karachi',
    service: { slug: 'custom-website-design', title: 'Custom Website Design', duration: 30, price: null },
    name: 'Sarah Ahmed', email: 'sarah@example.com', phone: '+92 300 1234567', company: 'Bloom Studio',
    notes: 'Redesigning our agency site — want something bold and fast.',
    createdAt: todayInTz(),
  };
  const out = path.join(__dirname);
  fs.writeFileSync(path.join(out, 'receipt-sample.pdf'), await buildReceiptPdf(b));
  fs.writeFileSync(path.join(out, 'email-customer.html'), customerEmailHtml(b));
  fs.writeFileSync(path.join(out, 'email-owner.html'), ownerEmailHtml(b, { kvActive: false }));
  fs.writeFileSync(path.join(out, 'appointment-sample.ics'), makeIcs(b, zonedToUtc(date, '11:00'), new Date(zonedToUtc(date, '11:00').getTime() + 1800000)));
  console.log('samples written to preview/');
})();
