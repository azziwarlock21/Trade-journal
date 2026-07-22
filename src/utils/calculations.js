// ─── Position Sizing Calculator ──────────────────────────────────────────────
// Pure math functions used by the PositionCalculator component.
// MGC (Micro Gold) = $10/point/contract. GC (Full Gold) = $100/point/contract.

export function getPointValue(contract) {
  return contract === "MGC" ? 10 : 100;
}

/**
 * Computes lot size, distances, and win/loss $ for a planned trade.
 * @param {Object} params
 * @param {number} params.account - account size in $
 * @param {number} params.riskPct - risk % (e.g. 0.5 for 0.5%)
 * @param {string} params.direction - "Long" | "Short"
 * @param {number} params.entry - entry price
 * @param {number} params.sl - stop loss price
 * @param {number} params.tp - take profit price
 * @param {string} params.contract - "MGC" | "GC"
 */
export function computePositionSize({ account, riskPct, direction, entry, sl, tp, contract }) {
  const pointValue = getPointValue(contract);
  const riskDollars = account * (riskPct / 100);

  let slPoints = null, tpPoints = null, lotSize = null;
  let lossAmt = null, winAmt = null, rrr = null;

  if (!isNaN(entry) && !isNaN(sl) && entry !== sl) {
    slPoints = direction === "Long" ? entry - sl : sl - entry;
    if (slPoints > 0) {
      lotSize = riskDollars / (slPoints * pointValue);
      lossAmt = lotSize * slPoints * pointValue;
    }
  }

  if (!isNaN(entry) && !isNaN(tp) && entry !== tp) {
    tpPoints = direction === "Long" ? tp - entry : entry - tp;
    if (tpPoints > 0 && lotSize) {
      winAmt = lotSize * tpPoints * pointValue;
    }
  }

  if (slPoints > 0 && tpPoints > 0) {
    rrr = (tpPoints / slPoints).toFixed(2);
  }

  return { pointValue, riskDollars, slPoints, tpPoints, lotSize, lossAmt, winAmt, rrr };
}

/**
 * Auto stop-loss for the fixed $150-risk / 1-contract MGC system.
 * $150 ÷ $10/pt = 15 points from entry, rounded to the nearest whole number.
 */
export function computeAutoStopLoss(entry, direction, riskDollars = 150, pointValue = 10) {
  const slDist = riskDollars / pointValue;
  return direction === "Long"
    ? Math.round(entry - slDist)
    : Math.round(entry + slDist);
}
