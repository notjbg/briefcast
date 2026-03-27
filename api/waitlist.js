const { json } = require('./_utils');

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 25_000) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function maybeAddToResend(email) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey) {
    console.warn('briefcast.waitlist.resend_skipped', 'RESEND_API_KEY not set');
    return;
  }
  if (!audienceId) {
    console.warn('briefcast.waitlist.resend_skipped', 'RESEND_AUDIENCE_ID not set');
    return;
  }

  const response = await fetch('https://api.resend.com/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ email, audience_id: audienceId })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend ${response.status}: ${body.slice(0, 120)}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const { email } = await parseBody(req);
    const cleaned = String(email || '').trim().toLowerCase();
    if (cleaned.length > 254) return json(res, 400, { error: 'Invalid email address' }, 5);
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned);
    if (!valid) return json(res, 400, { error: 'Invalid email address' }, 5);

    console.log('briefcast.waitlist', { email: cleaned, source: 'briefcast-waitlist', createdAt: new Date().toISOString() });

    try {
      await maybeAddToResend(cleaned);
    } catch (resendErr) {
      console.warn('briefcast.waitlist.resend_failed', resendErr.message);
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('briefcast.waitlist.error', error.message);
    return json(res, 400, { error: 'Invalid request' }, 5);
  }
};
