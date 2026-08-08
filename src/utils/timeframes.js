// ─── timeframes.js ──────────────────────────────────────────────────────
// Single source of truth for every timeframe the chart-reconstruction
// system supports. `unit`/`unitNumber` map straight to the TopstepX/
// ProjectX gateway's History/retrieveBars params (same gateway family as
// Auth/loginKey, Trade/search — see api/get-trade-bars.js), so every
// timeframe below is a NATIVE bar size from the data provider. Nothing is
// resampled/aggregated from 1-minute bars on the frontend — the gateway
// already gives us second/minute/hour/day/week/month resolution directly,
// so asking for e.g. 4-hour bars just means unit=Hour, unitNumber=4.
//
// unit: 1=Second 2=Minute 3=Hour 4=Day 5=Week 6=Month

export const TIMEFRAMES = {
  "1D": { key: "1D", label: "1D",  unit: 4, unitNumber: 1,  contextBars: 40, order: 0, purpose: "Higher-timeframe context — broader trend/structure" },
  "4H": { key: "4H", label: "4H",  unit: 3, unitNumber: 4,  contextBars: 40, order: 1, purpose: "Intermediate structure — major swings and trend" },
  "1H": { key: "1H", label: "1H",  unit: 3, unitNumber: 1,  contextBars: 40, order: 2, purpose: "Primary setup/context — structure around the trade" },
  "15m": { key: "15m", label: "15m", unit: 2, unitNumber: 15, contextBars: 40, order: 3, purpose: "Setup/execution context — price action into entry" },
  "5m": { key: "5m", label: "5m",  unit: 2, unitNumber: 5,  contextBars: 40, order: 4, purpose: "Precise execution — candles immediately around the trade" },
  // Legacy timeframe — kept working (nothing is removed), just no longer
  // the default/primary view. contextBars is in *minutes* here directly
  // via the 30-min pad it always used, so leave it distinct from the
  // bar-count-based padding the others use (see barPaddingMinutes below).
  "1m": { key: "1m", label: "1m",  unit: 2, unitNumber: 1,  contextBars: 30, order: 5, purpose: "Legacy — raw execution ticks" },
};

// The 5 timeframes the strategy actually cares about, in priority order
// (1D → 4H → 1H → 15m → 5m). "1m" is intentionally excluded from this list
// — it still works, it's just not part of the primary set anymore.
export const PRIMARY_TIMEFRAMES = ["1D", "4H", "1H", "15m", "5m"];

export const DEFAULT_TIMEFRAME = "1H";

// How many minutes one bar of a given timeframe spans.
function barMinutes({ unit, unitNumber }) {
  if (unit === 2) return unitNumber;              // Minute
  if (unit === 3) return unitNumber * 60;          // Hour
  if (unit === 4) return unitNumber * 60 * 24;     // Day
  if (unit === 5) return unitNumber * 60 * 24 * 7; // Week
  if (unit === 6) return unitNumber * 60 * 24 * 30;// Month (approx)
  return unitNumber; // Second-level, treat as sub-minute
}

// Minutes of padding to fetch before entry / after exit for a timeframe,
// so there's real context on both sides regardless of how short the trade
// itself was relative to the bar size.
export function barPaddingMinutes(tf) {
  return barMinutes(tf) * tf.contextBars;
}
