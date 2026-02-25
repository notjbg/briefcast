const { AIRPORTS, json } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  return json(res, 200, { count: AIRPORTS.length, airports: AIRPORTS }, 86400);
};
