// ============================================================
// get-trade-bars.js — Historical OHLCV bar proxy for chart
// reconstruction. Given a contractId + time window, returns raw
// 1m/5m/15m bars from TopstepX so the client can deterministically
// redraw the market exactly as it looked around a trade.
//
// This never guesses anything — it's a thin authenticated proxy.
// All entry/exit placement logic stays on the client, driven by
// the trade's own exact fill timestamps/prices.
// ============================================================

const TOPSTEPX_API = "https://api.topstepx.com";

const TSX_USERNAME = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY  = process.env.TOPSTEPX_API_KEY;
const CRON_SECRET  = process.env.CRON_SECRET || "";

// ─── Token cache ────────────────────────────────────────────────────────
// The chart/MAE-MFE background pipeline can fire many bar requests back to
// back (up to 6 per trade — 1 for MAE/MFE + 5 timeframes — across a whole
// backlog of trades). Re-authenticating with TopstepX on every single one
// of those calls is what was tripping TopstepX's own login rate limit
// (which returns an HTML/plain-text "too many requests" response instead
// of JSON — that's the "auth response was not JSON" error). Module-level
// vars persist across invocations on a warm serverless instance, so this
// reuses one token instead of logging in every time.
let cachedToken = null;
let cachedTokenAt = 0;
const TOKEN_TTL_MS = 15 * 60 * 1000; // conservative — re-auth every 15 min

async function auth(forceFresh = false) {
  if (!forceFresh && cachedToken && Date.now() - cachedTokenAt < TOKEN_TTL_MS) {
    return cachedToken;
  }

  const r = await fetch(`${TOPSTEPX_API}/api/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ userName: TSX_USERNAME, apiKey: TSX_API_KEY }),
  });

  const text = await r.text();
  let d;
  try { d = JSON.parse(text); }
  catch { throw new Error(`TopstepX auth response was not JSON (status ${r.status}): ${text.slice(0, 200) || "(empty body)"}`); }

  if (!d.token) throw new Error(`TopstepX authentication failed: ${JSON.stringify(d)}`);

  cachedToken = d.token;
  cachedTokenAt = Date.now();
  return cachedToken;
}

// ProjectX/TopstepX gateway `unit` values for History/retrieveBars:
// 1 = Second, 2 = Minute, 3 = Hour, 4 = Day, 5 = Week, 6 = Month.
// This matches the same gateway family (Auth/loginKey, Trade/search,
// Account/search) already used by api/sync-topstepx.js in this project.
//
// The caller (src/utils/timeframes.js) decides unit + unitNumber per
// timeframe (e.g. unit=3/unitNumber=4 for a native 4-hour bar) — this
// endpoint is a thin proxy, it never resamples or aggregates anything
// itself. Every timeframe returned is a native bar size from TopstepX.
const VALID_UNITS = new Set([1, 2, 3, 4, 5, 6]);
const DEFAULT_UNIT = 2; // Minute, for backward compatibility with callers
                        // that only ever asked for 1m bars (unit omitted).

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  if (CRON_SECRET) {
    const authHeader = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (authHeader !== CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  try {
    const {
      contractId,
      startTime,
      endTime,
      unit = DEFAULT_UNIT,
      unitNumber = 1, // e.g. unit=2 (Minute) + unitNumber=5 -> native 5-minute bars
    } = req.body || {};

    if (!contractId) return res.status(400).json({ error: "contractId is required" });
    if (!startTime || !endTime) return res.status(400).json({ error: "startTime and endTime are required" });
    if (!VALID_UNITS.has(unit)) return res.status(400).json({ error: `unit must be one of ${[...VALID_UNITS].join(", ")}` });
    if (!TSX_USERNAME || !TSX_API_KEY) {
      return res.status(500).json({ error: "TOPSTEPX_USERNAME / TOPSTEPX_API_KEY not configured on the server" });
    }

    const token = await auth();

    let response = await fetch(`${TOPSTEPX_API}/api/History/retrieveBars`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contractId,
        live: false, // historical data, not the live/practice feed
        startTime,
        endTime,
        unit,
        unitNumber,
        limit: 20000,
        includePartialBar: false,
      }),
    });

    // Cached token might have gone stale server-side before our local TTL
    // caught up — one retry with a forced fresh login before giving up.
    if (response.status === 401) {
      const freshToken = await auth(true);
      response = await fetch(`${TOPSTEPX_API}/api/History/retrieveBars`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({
          contractId,
          live: false,
          startTime,
          endTime,
          unit,
          unitNumber,
          limit: 20000,
          includePartialBar: false,
        }),
      });
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Historical bars response was not JSON: ${text.slice(0, 300)}`); }

    if (!response.ok || data.success === false) {
      throw new Error(`Historical bars failed: ${JSON.stringify(data)}`);
    }

    const bars = (data.bars || []).map((b) => ({
      time: b.t,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
    }));

    return res.status(200).json({
      success: true,
      contractId,
      count: bars.length,
      bars,
    });
  } catch (error) {
    console.error("get-trade-bars error:", error);
    return res.status(500).json({ error: error.message });
  }
}
