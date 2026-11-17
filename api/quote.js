// Vercel Function: receives the website's quote request form and emails it
// to the Unison inbox through Hostinger's mail server (SMTP).
//
// Environment variables (Vercel project settings, added by the owner):
//   SMTP_USER  - Hostinger mailbox that sends the email, e.g. quotes@unisontransportation.com
//   SMTP_PASS  - that mailbox's password
//   QUOTE_TO   - optional, inbox that receives requests (default below)
//   SMTP_HOST / SMTP_PORT - optional overrides (defaults: smtp.hostinger.com, 465 over SSL)

import nodemailer from 'nodemailer';

const DEFAULT_TO = 'Info@unisontransportation.com';

const LIMITS = {
  name: 120, phone: 40, email: 200, occasion: 80, passengers: 4,
  date: 20, time: 20, pickup: 200, destination: 200, message: 3000,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  // Honeypot: real visitors never fill this in. Pretend success for bots.
  if (clean(body.company_website, 200)) return json(200, { ok: true });

  const f = {};
  for (const [k, max] of Object.entries(LIMITS)) f[k] = clean(body[k], max);

  if (!f.name || !f.phone || !f.email || !f.date) {
    return json(400, { error: 'Please add your name, phone, email and date.' });
  }
  if (!EMAIL_RE.test(f.email)) {
    return json(400, { error: 'That email address doesn’t look right.' });
  }

  let estimate = null;
  if (body.estimate && typeof body.estimate === 'object') {
    const lines = Array.isArray(body.estimate.lines) ? body.estimate.lines.slice(0, 20) : [];
    estimate = {
      summary: clean(body.estimate.summary, 300),
      total: Number(body.estimate.total) || 0,
      lines: lines.map((l) => ({ label: clean(l && l.label, 120), amount: Number(l && l.amount) || 0 })),
    };
  }

  // Trim: stray spaces or line breaks from copy-pasting into Vercel break the login.
  const SMTP_USER = (process.env.SMTP_USER || '').trim();
  const SMTP_PASS = (process.env.SMTP_PASS || '').trim();
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('quote: SMTP_USER / SMTP_PASS are not set');
    return json(503, { error: 'Online requests are temporarily unavailable.' });
  }

  const rows = [
    ['Name', f.name], ['Phone', f.phone], ['Email', f.email],
    ['Occasion', f.occasion], ['Passengers', f.passengers],
    ['Date', f.date], ['Pickup time', f.time],
    ['Pickup', f.pickup], ['Destination', f.destination],
  ].filter(([, v]) => v);

  const text = [
    'New quote request from unisontransportation.com',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'The plan:',
    f.message || '(none)',
    ...(estimate
      ? ['', `Website estimate: ${money(estimate.total)} (${estimate.summary})`, ...estimate.lines.map((l) => `  ${l.label}: ${money(l.amount)}`)]
      : []),
  ].join('\n');

  const html = `
  <div style="font-family:Helvetica,Arial,sans-serif;color:#111;max-width:620px">
    <h2 style="margin:0 0 4px">New quote request</h2>
    <p style="margin:0 0 20px;color:#666">From unisontransportation.com. Reply to this email to answer ${esc(f.name)} directly.</p>
    <table style="border-collapse:collapse;width:100%">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0">${esc(v)}</td></tr>`).join('')}
    </table>
    <h3 style="margin:24px 0 6px">The plan</h3>
    <p style="margin:0;white-space:pre-wrap">${esc(f.message || '(none)')}</p>
    ${estimate ? `
    <h3 style="margin:24px 0 6px">Website estimate: ${esc(money(estimate.total))}</h3>
    <p style="margin:0 0 8px;color:#666">${esc(estimate.summary)}</p>
    <table style="border-collapse:collapse;width:100%">
      ${estimate.lines.map((l) => `<tr><td style="padding:4px 12px 4px 0">${esc(l.label)}</td><td style="padding:4px 0;text-align:right">${esc(money(l.amount))}</td></tr>`).join('')}
    </table>` : ''}
  </div>`;

  const port = Number(process.env.SMTP_PORT) || 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port,
    secure: port === 465, // SSL on 465; STARTTLS on 587
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await transporter.sendMail({
      // Hostinger only lets a mailbox send as itself, so "from" is always SMTP_USER.
      from: { name: 'Unison Website', address: SMTP_USER },
      to: process.env.QUOTE_TO || DEFAULT_TO,
      replyTo: { name: f.name, address: f.email },
      subject: `Quote request: ${f.occasion || 'Trip'} on ${f.date} (${f.name})`,
      text,
      html,
    });
  } catch (err) {
    // Log the server's reply (never the password) so failures are diagnosable.
    const raw = process.env.SMTP_USER || '';
    console.error('quote: SMTP error', err && err.code, '|', err && (err.response || err.message), '|',
      `user looks like an email: ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SMTP_USER)}, user had extra spaces: ${raw !== raw.trim()}, pass had extra spaces: ${(process.env.SMTP_PASS || '') !== SMTP_PASS}`);
    return json(502, { error: 'We couldn’t send your request just now.' });
  }

  return json(200, { ok: true });
}
