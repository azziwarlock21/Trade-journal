// ============================================================
// DEBUG ONLY — Deploy temporarily to see raw fill data
// File: /api/debug-fills.js
// Remove after debugging
// ============================================================

const TOPSTEPX_API   = "https://api.topstepx.com";
const TSX_USERNAME   = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY    = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID;
const CRON_SECRET    = process.env.CRON_SECRET || "";

async function tsxAuth() {
  const res = await fetch(`${TOPSTEPX_API}/api/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json" },
    body: JSON.stringify({ userName: TSX_USERNAME, apiKey: TSX_API_KEY }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function tsxGetAccountId(token) {
  const res = await fetch(`${TOPSTEPX_API}/api/Account/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ onlyActiveAccounts: true }),
  });
  const data = await res.json();
  if (!data.success || !data.accounts?.length) throw new Error(`No accounts: ${JSON.stringify(data)}`);
  if (TSX_ACCOUNT_ID) {
    const match = data.accounts.find(a => String(a.id) === String(TSX_ACCOUNT_ID) || a.name === TSX_ACCOUNT_ID);
    if (match) return match.id;
  }
  return data.accounts[0].id;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (CRON_SECRET) {
   // const provided = (req.headers.authorization || "").replace("Bearer ", "").trim();
  //  if (provided !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token     = await tsxAuth();
    const accountId = await tsxGetAccountId(token);

    // Fetch last 7 days of fills
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const to   = new Date().toISOString();

    const res2 = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ accountId, startTimestamp: from, endTimestamp: to }),
    });
    const data = await res2.json();

    // Return ALL raw fill fields so we can see exactly what TopstepX sends
    return res.status(200).json({
      accountId,
      fillCount: data.trades?.length || 0,
      fills: (data.trades || []).slice(0, 50).map(f => ({
        id:                 f.id,
        contractId:         f.contractId,
        creationTimestamp:  f.creationTimestamp,
        price:              f.price,
        size:               f.size,
        side:               f.side,
        profitAndLoss:      f.profitAndLoss,
        fees:               f.fees,
        voided:             f.voided,
        orderId:            f.orderId,
        type:               f.type,
        // Include every field we might have missed
        _raw:               f,
      })),
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
