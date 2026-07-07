// Temporary diagnostic: reports WHICH auth sources exist at runtime (never values).
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    envApiKey: !!process.env.AI_GATEWAY_API_KEY,
    envOidc: !!process.env.VERCEL_OIDC_TOKEN,
    headerOidc: !!req.headers['x-vercel-oidc-token']
  }));
};
