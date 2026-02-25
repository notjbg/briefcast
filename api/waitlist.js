const fs = require('fs/promises');
const path = require('path');
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const { email } = await parseBody(req);
    const cleaned = String(email || '').trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned);
    if (!valid) return json(res, 400, { error: 'Invalid email address' }, 5);

    const event = {
      email: cleaned,
      source: 'briefcast-waitlist',
      createdAt: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null
    };

    console.log('briefcast.waitlist', event);

    try {
      const file = path.join('/tmp', 'briefcast-waitlist.jsonl');
      await fs.appendFile(file, `${JSON.stringify(event)}\n`, 'utf8');
    } catch (fileErr) {
      console.warn('briefcast.waitlist.file_write_failed', fileErr.message);
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 400, { error: error.message }, 5);
  }
};
