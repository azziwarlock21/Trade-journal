const TOPSTEPX_API   = "https://api.topstepx.com";
const TSX_USERNAME   = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY    = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID;
const CRON_SECRET    = process.env.CRON_SECRET || "";

async function auth() {
  const r = await fetch(`${TOPSTEPX_API}/api/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: TSX_USERNAME, apiKey: TSX_API_KEY }),
  });
  const d = await r.json();
  if (!d.token) throw new Error(`Auth: ${JSON.stringify(d)}`);
  return d.token;
}

async function getAccountId(token) {
  const r = await fetch(`${TOPSTEPX_API}/api/Account/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ onlyActiveAccounts: true }),
  });
  const d = await r.json();
  if (!d.accounts?.length) throw new Error("No accounts");
  if (TSX_ACCOUNT_ID) {
    const m = d.accounts.find(a => String(a.id) === String(TSX_ACCOUNT_ID));
    if (m) return m.id;
  }
  return d.accounts[0].id;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (CRON_SECRET) {
    const a = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (a !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const token     = await auth();
    const accountId = await getAccountId(token);

    // Fetch from May 1 2026 to capture full history
    const from = "2026-05-01T00:00:00.000Z";
    const to   = new Date().toISOString();

    const r = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ accountId, startTimestamp: from, endTimestamp: to }),
    });
    const d = await r.json();
    const fills = (d.trades || []).filter(f => !f.voided && f.size > 0);

    return res.status(200).json({
      accountId,
      from,
      to,
      totalFills: fills.length,
      // Sort oldest first so the pairing logic is easy to follow
      fills: fills
        .sort((a, b) => new Date(a.creationTimestamp) - new Date(b.creationTimestamp))
        .map(f => ({
          id:       f.id,
          time:     f.creationTimestamp,
          side:     f.side === 0 ? "BUY" : "SELL",
          size:     f.size,
          price:    f.price,
          pnl:      f.profitAndLoss,   // null = open leg, number = close leg
          fees:     f.fees,
          orderId:  f.orderId,
          contract: f.contractId,
        })),
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
