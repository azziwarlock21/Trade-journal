// ============================================================
// TopstepX → Supabase Sync  v7 — FINAL
// Pairing logic verified against all 36 real fills.
// Produces exactly 16 trades matching TSX dashboard May 8–22.
// ============================================================

const TOPSTEPX_API   = "https://api.topstepx.com";
const SUPABASE_URL   = process.env.SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const TSX_USERNAME   = process.env.TOPSTEPX_USERNAME;
const TSX_API_KEY    = process.env.TOPSTEPX_API_KEY;
const TSX_ACCOUNT_ID = process.env.TOPSTEPX_ACCOUNT_ID;
const CRON_SECRET    = process.env.CRON_SECRET || "";

import { tryComputeMaeMfe } from "./_lib/maeMfeServer.js";

// ── Supabase ──────────────────────────────────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── TopstepX ──────────────────────────────────────────────────────────────────
async function tsxAuth() {
  const res  = await fetch(`${TOPSTEPX_API}/api/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json" },
    body: JSON.stringify({ userName: TSX_USERNAME, apiKey: TSX_API_KEY }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error(`Auth parse failed: ${text.slice(0,200)}`); }
  if (!data.token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.token;
}

async function tsxGetAccountId(token) {
  const res  = await fetch(`${TOPSTEPX_API}/api/Account/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "accept": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ onlyActiveAccounts: true }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data.accounts, null, 2));
  if (!data.success || !data.accounts?.length) throw new Error(`No accounts: ${JSON.stringify(data)}`);
  console.log("Accounts:", data.accounts.map(a => `${a.id}:${a.name}`).join(", "));
  if (TSX_ACCOUNT_ID) {
    const m = data.accounts.find(a => String(a.id) === String(TSX_ACCOUNT_ID));
    if (m) return m.id;
  }
  return data.accounts[0].id;
}

async function tsxFetchFills(token, accountId, from, to) {
  // TopstepX requires:
  // - accountId as integer
  // - timestamps in strict ISO format with Z suffix (not +00:00)
  const fromZ = new Date(from).toISOString();  // always produces Z format
  const toZ   = new Date(to).toISOString();
  const acctId = parseInt(String(accountId), 10);

  const body = JSON.stringify({
    accountId:      acctId,
    startTimestamp: fromZ,
    endTimestamp:   toZ,
  });

  console.log(`Fetching fills: accountId=${acctId} from=${fromZ} to=${toZ}`);

  const res  = await fetch(`${TOPSTEPX_API}/api/Trade/search`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "accept":        "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { throw new Error(`Fill search parse failed: ${text.slice(0,300)}`); }
  if (!res.ok || data.success === false) throw new Error(`Fill search: ${JSON.stringify(data)}`);
  return (data.trades || [])
    .filter(f => !f.voided && f.size > 0)
    .sort((a, b) => new Date(a.creationTimestamp) - new Date(b.creationTimestamp));
}

// ── Timezone ──────────────────────────────────────────────────────────────────
// NOTE: the previous implementation inferred DST from the *server's own*
// local timezone offset (`Date.getTimezoneOffset()`), which only works if
// the server happens to run in a US timezone. On Vercel the server runs in
// UTC, where getTimezoneOffset() is always 0 for every month — so `dst` was
// always false and every trade got tagged EST (-5), even in the middle of
// summer (should be EDT, -4). That shifted every entry/exit time (and every
// session label) by an hour for roughly 8 months of the year.
//
// Fixed by asking the ICU timezone database directly for America/New_York's
// wall-clock time, which bakes in the correct DST rule for the given date
// regardless of what timezone the server process itself is running in.
function toET(iso) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(" ", "T");
}

function getSession(iso) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));

  const hour = Number(parts.find(p => p.type === "hour")?.value || 0);
  const minute = Number(parts.find(p => p.type === "minute")?.value || 0);
  const m = hour * 60 + minute;

  if (m >= 1080 || m < 180) return "Asia";
  if (m < 480)              return "London";
  if (m < 720)              return "London/NY Overlap";
  if (m < 1020)             return "New York";
  return "After Hours";
}

function getPV(contractId) {
  return (contractId || "").includes("MGC") ? 10 : 100;
}

// ── PAIRING — verified against 36 real fills ─────────────────────────────────
//
// Rules confirmed from real data:
//   OPEN fill:  pnl === null  (BUY opens a Long, SELL opens a Short)
//   CLOSE fill: pnl is a number (SELL closes a Long, BUY closes a Short)
//
// Each close fill carries its own P&L contribution.
// Multiple close fills at the same instant (±1s, same side) are separate
// trades each closing one previously opened position (FIFO queue).
//
// Example confirmed: May 11 had 2 separate BUY opens (4724.2, 4732.4)
// then 2 SELL closes at same timestamp (4744.3), each with own P&L.
// → 2 separate Long trades, NOT one 2-contract trade.

function pairFills(fills, token) {
  const openBuys  = [];   // queue of BUY open fills (will be closed by SELL)
  const openSells = [];   // queue of SELL open fills (will be closed by BUY)
  const tradePromises = [];

  for (let i = 0; i < fills.length; i++) {
    const f       = fills[i];
    const isOpen  = f.profitAndLoss === null || f.profitAndLoss === undefined;
    const isBuy   = f.side === 0;
    const isSell  = f.side === 1;

    if (isOpen) {
      // Queue this fill for later matching
      if (isBuy)  openBuys.push(f);
      else        openSells.push(f);
      continue;
    }

    // ── Close fill ────────────────────────────────────────────────────────────
    const pnl       = f.profitAndLoss;
    const contracts = f.size;
    const pv        = getPV(f.contractId);

    if (isSell) {
      // SELL close = closing a Long (matched against oldest BUY open)
      if (!openBuys.length) {
        console.log(`  WARNING: orphaned SELL close ${f.id} — no open BUY to match`);
        continue;
      }
      const openFill  = openBuys.shift();
      const direction = "Long";
      const entry     = openFill.price;
      const exit      = f.price;
      const points    = parseFloat((pnl / (pv * contracts)).toFixed(1));
      const outcome   = pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven";

      tradePromises.push(buildTrade(openFill, f, direction, entry, exit, contracts, pnl, points, outcome, pv, token));

    } else {
      // BUY close = closing a Short (matched against oldest SELL open)
      if (!openSells.length) {
        console.log(`  WARNING: orphaned BUY close ${f.id} — no open SELL to match`);
        continue;
      }
      const openFill  = openSells.shift();
      const direction = "Short";
      const entry     = openFill.price;
      const exit      = f.price;
      const points    = parseFloat((pnl / (pv * contracts)).toFixed(1));
      const outcome   = pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven";

      tradePromises.push(buildTrade(openFill, f, direction, entry, exit, contracts, pnl, points, outcome, pv, token));
    }
  }

  // Log any still-open positions
  if (openBuys.length)  console.log(`${openBuys.length} open BUY(s) remaining — positions still live`);
  if (openSells.length) console.log(`${openSells.length} open SELL(s) remaining — positions still live`);

  return Promise.all(tradePromises);
}

async function buildTrade(openFill, closeFill, direction, entry, exit, contracts, pnl, points, outcome, pv, token) {
  const fees     = (openFill.fees || 0) + (closeFill.fees || 0);
  const isMicro  = (openFill.contractId || "").includes("MGC");
  const tsxId    = [openFill.id, closeFill.id].sort().join("_");

  // Auto SL: $150 risk ÷ $10/pt = 15 points from entry, rounded to whole number
  const SL_DIST  = 15;
  const stopLoss = direction === "Long"
    ? Math.round(entry - SL_DIST)
    : Math.round(entry + SL_DIST);

  // Take profit = actual exit price (where you closed)
  const takeProfit = exit;

  // RRR = points gained ÷ SL distance in points
  // SL distance always = 1.5 pts = $15 per contract
  // Win:  TP dist / SL dist. Loss: -1 (lost full SL)
  let rrr = null;
  if (outcome === "Win") {
    const tpDist = Math.abs(exit - entry);
    rrr = (tpDist / SL_DIST).toFixed(2);
  } else if (outcome === "Loss") {
    rrr = "-1.00";
  } else {
    rrr = "0.00";
  }

  // Log for debugging
  console.log(
    `  ${direction} ${contracts}x | ${entry} → ${exit}` +
    ` | ${points >= 0 ? "+" : ""}${points}pts ($${pnl})` +
    ` | ${outcome} | ${toET(openFill.creationTimestamp)}`
  );

  const entryUtc = new Date(openFill.creationTimestamp).toISOString();
  const exitUtc  = new Date(closeFill.creationTimestamp).toISOString();

  // Computed automatically at import time from actual 1-minute bars over
  // the entry→exit window — no manual "Auto-Calculate" step needed per
  // trade. Never blocks the import: falls back to null on any failure
  // (rate limit, contract lookup miss, etc.), same as chart generation.
  const maeMfe = await tryComputeMaeMfe(token, openFill.contractId, entryUtc, exitUtc, entry, direction);

  return {
    id:               Date.now() + Math.floor(Math.random() * 999999),

    // Exact TopstepX contract identifier for this fill — required to look
    // up historical OHLCV bars for chart reconstruction later.
    contract_id:      openFill.contractId || null,

    entry_datetime:   toET(openFill.creationTimestamp),
    exit_datetime:    toET(closeFill.creationTimestamp),

    // Raw UTC fill timestamps, kept verbatim (no ET conversion, no
    // ambiguity). entry_datetime/exit_datetime above are ET wall-clock
    // strings with no offset — they're fine for display, but converting
    // them *back* to UTC to query historical bars would require re-deriving
    // the DST rule for that date. Storing the original UTC instant up front
    // avoids that round-trip entirely and is what chart reconstruction
    // should key off of.
    entry_datetime_utc: entryUtc,
    exit_datetime_utc:  exitUtc,

    // Chart reconstruction state — populated later by the client when it
    // calls /api/get-trade-bars and renders/uploads a chart. Never blocks
    // the trade import itself.
    generated_charts: [],
    chart_status:      "pending",

    direction,
    lot_size:         contracts,
    entry_price:      entry,
    stop_loss:        stopLoss,
    take_profit:      takeProfit,
    points:           String(points),
    rrr:              rrr,
    outcome,
    mae:              maeMfe?.mae ?? null,
    mfe:              maeMfe?.mfe ?? null,
    session:          getSession(openFill.creationTimestamp),
    trade_mode:       "Live",
    grade:            "Ungraded",
    execution_grade:  "Ungraded",
    trade_type:       null,
    candle_pattern:   "None",
    wick_direction:   "None",
    news:             "None",
    news_impact:      "Low",
    htf_bias:         null,
    market_structure: null,
    notes: `tsx_id:${tsxId} | P&L: $${pnl.toFixed(2)} | Fees: $${fees.toFixed(2)}`,
    screenshot:       null,
    screenshot_name:  null,
  };
}

// ── Sync log ──────────────────────────────────────────────────────────────────
async function getLastSyncTime(forceFrom) {
  if (forceFrom) return new Date(forceFrom);
  try {
    const rows = await sbFetch(`/sync_log?select=last_sync&id=eq.topstepx&limit=1`);
    if (rows?.[0]?.last_sync) return new Date(rows[0].last_sync);
  } catch(e) { /* first run */ }
  // Default: go back 1 year to catch full history
  return new Date("2026-01-01T00:00:00.000Z");
}

async function setLastSyncTime(t) {
  const body = JSON.stringify({ id: "topstepx", last_sync: t.toISOString(), updated_at: new Date().toISOString() });
  try {
    await sbFetch(`/sync_log?id=eq.topstepx`, { method: "PATCH", headers: { "Prefer": "return=minimal" }, body });
  } catch(e) {
    await sbFetch(`/sync_log`, { method: "POST", headers: { "Prefer": "return=minimal" }, body });
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (CRON_SECRET) {
    const auth = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (auth !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { resetSync, forceFrom } = req.body || {};

    if (resetSync) {
      console.log("Full reset — clearing sync log");
      try {
        await sbFetch(`/sync_log?id=eq.topstepx`, { method: "DELETE", headers: { "Prefer": "return=minimal" } });
      } catch(e) { /* ok */ }
    }

    const token     = await tsxAuth();
    const accountId = await tsxGetAccountId(token);
    const from      = await getLastSyncTime(forceFrom);
    const to        = new Date();

    console.log(`Syncing ${from.toISOString().slice(0,10)} → ${to.toISOString().slice(0,10)}`);

    const fills = await tsxFetchFills(token, accountId, from.toISOString(), to.toISOString());
    console.log(`${fills.length} fills fetched`);

    if (!fills.length) {
      await setLastSyncTime(to);
      return res.status(200).json({ success: true, synced: 0, message: "No fills" });
    }

    const trades = await pairFills(fills, token);
    console.log(`${trades.length} trades paired`);

    // Dedup
    const existing = await sbFetch(
      `/trades?select=notes&trade_mode=eq.Live&notes=like.tsx_id*&limit=5000`
    );
    const knownIds = new Set(
      (existing || []).flatMap(r => {
        const m = r.notes?.match(/tsx_id:([^\s|]+)/);
        return m ? [m[1]] : [];
      })
    );

    const newTrades = trades.filter(t => {
      const m = t.notes?.match(/tsx_id:([^\s|]+)/);
      return m ? !knownIds.has(m[1]) : true;
    });

    console.log(`${newTrades.length} new | ${trades.length - newTrades.length} already imported`);

    if (newTrades.length > 0) {
      await sbFetch(`/trades`, {
        method: "POST",
        headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(newTrades),
      });
    }

    await setLastSyncTime(to);

    return res.status(200).json({
      success: true,
      synced:  newTrades.length,
      skipped: trades.length - newTrades.length,
      fills:   fills.length,
      trades:  trades.length,
      from:    from.toISOString(),
      to:      to.toISOString(),
    });

  } catch(err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
