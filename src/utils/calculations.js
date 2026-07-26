// ─── Position Sizing Calculator ──────────────────────────────────────────────
// Pure math functions used by the PositionCalculator component.
// MGC (Micro Gold) = $10/point/contract. GC (Full Gold) = $100/point/contract.

export function getPointValue(contract) {
  return contract === "MGC" ? 10 : 100;
}

// Per-side commission (entry OR exit, not round-trip) at TopstepX/CME retail
// rates. Confirmed from real MGC fill data: fees: 0.62 per 1-lot fill,
// 1.24 per 2-lot fill — i.e. $0.62/contract/side for MGC. GC commission is
// the standard $1.25/contract/side quoted by TopstepX for full-size Gold.
const COMMISSION_PER_SIDE = { MGC: 0.62, GC: 1.25 };

export function getCommissionPerSide(contract) {
  return COMMISSION_PER_SIDE[contract] ?? COMMISSION_PER_SIDE.MGC;
}

/**
 * Round-trip commission (entry + exit) for a given lot size and contract.
 */
export function computeRoundTripCommission(lotSize, contract) {
  if (!lotSize || isNaN(lotSize)) return 0;
  return lotSize * getCommissionPerSide(contract) * 2;
}

/**
 * Computes lot size, distances, and win/loss $ for a planned trade.
 * Win/loss amounts are gross (price-based) AND net-of-commission, since
 * commission is a fixed cost per contract regardless of whether the trade
 * wins or loses — it should reduce both sides symmetrically.
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
  let commission = null, lossAmtNet = null, winAmtNet = null;

  if (!isNaN(entry) && !isNaN(sl) && entry !== sl) {
    slPoints = direction === "Long" ? entry - sl : sl - entry;
    if (slPoints > 0) {
      lotSize = riskDollars / (slPoints * pointValue);
      lossAmt = lotSize * slPoints * pointValue;
      commission = computeRoundTripCommission(lotSize, contract);
      // A loss gets WORSE after commission (you lose the risk amount plus fees)
      lossAmtNet = lossAmt + commission;
    }
  }

  if (!isNaN(entry) && !isNaN(tp) && entry !== tp) {
    tpPoints = direction === "Long" ? tp - entry : entry - tp;
    if (tpPoints > 0 && lotSize) {
      winAmt = lotSize * tpPoints * pointValue;
      // A win gets SMALLER after commission
      winAmtNet = winAmt - (commission ?? computeRoundTripCommission(lotSize, contract));
    }
  }

  if (slPoints > 0 && tpPoints > 0) {
    rrr = (tpPoints / slPoints).toFixed(2);
  }

  return {
    pointValue, riskDollars, slPoints, tpPoints, lotSize,
    lossAmt, winAmt, rrr,
    commission, lossAmtNet, winAmtNet,
  };
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
