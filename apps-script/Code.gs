/*************************************************************
 * KRAKEN CODE — BOOKING EMAIL RELAY (Google Apps Script)
 * ----------------------------------------------------------
 * Why: Vercel functions + Gmail SMTP = deferred delivery
 * (minutes to ~1 hour). This relay receives an HTTPS call from
 * your Vercel function and sends the email INTERNALLY through
 * your own Gmail → arrives in seconds, appears in your Sent,
 * zero third-party watermarks.
 *
 * SETUP (one-time, ~4 minutes):
 *  1) Replace PASTE_YOUR_SECRET_HERE below with your secret
 *     (same value you put in Vercel env APPS_SCRIPT_SECRET).
 *  2) Deploy → New deployment → type: Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  3) Authorize when asked (MailApp permission).
 *  4) Copy the Web app URL (ends with /exec) into Vercel env
 *     APPS_SCRIPT_URL, then redeploy the Vercel project.
 *
 * Free Gmail quota: 100 emails/day — plenty for bookings.
 *************************************************************/
const SECRET = 'PASTE_YOUR_SECRET_HERE';

function doPost(e) {
  var out;
  try {
    var data = JSON.parse(e.postData.contents);
    if (!data || data.secret !== SECRET) {
      out = { ok: false, error: 'unauthorized' };
    } else {
      var blobs = (data.attachments || []).map(function (a) {
        return Utilities.newBlob(Utilities.base64Decode(a.base64), a.contentType, a.filename);
      });
      var inline = {};
      (data.inlineImages || []).forEach(function (a) {
        inline[a.name] = Utilities.newBlob(Utilities.base64Decode(a.base64), a.contentType, a.name);
      });
      var opts = {
        to: data.to,
        subject: data.subject,
        htmlBody: data.html,
        name: data.fromName || 'Kraken Code',
        attachments: blobs
      };
      if (data.replyTo) opts.replyTo = data.replyTo;
      if ((data.inlineImages || []).length) opts.inlineImages = inline;
      MailApp.sendEmail(opts);
      out = { ok: true };
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
