// ─── Financial Calculations ───────────────────────────────────────────────
// Pure functions for the Payouts, Expenses, and Tax Estimator tabs.
// Kept separate from the trade-analytics utils since these operate on
// payout/expense records rather than trades.

/**
 * Explicit UTC month arithmetic — no timezone drift. Returns the number of
 * months an expense has been active, inclusive of the start month.
 */
export function calcExpenseMonths(exp) {
  if (!exp.monthly) return 1;
  const [sy, sm] = exp.startMonth.split("-").map(Number);
  const now = new Date();
  const ny = now.getUTCFullYear();
  const nm = now.getUTCMonth() + 1; // 1-indexed
  const diff = (ny - sy) * 12 + (nm - sm);
  return Math.max(1, diff + 1); // diff=0 when same month -> 1 month
}

export function calcExpenseTotal(exp) {
  return exp.monthly
    ? parseFloat((exp.amount * calcExpenseMonths(exp)).toFixed(2))
    : exp.amount;
}

// ─── 2024 US Federal tax brackets ──────────────────────────────────────────
const FEDERAL_BRACKETS = {
  single: [
    { limit: 11600, rate: 0.10 },
    { limit: 47150, rate: 0.12 },
    { limit: 100525, rate: 0.22 },
    { limit: 191950, rate: 0.24 },
    { limit: 243725, rate: 0.32 },
    { limit: 609350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married: [
    { limit: 23200, rate: 0.10 },
    { limit: 94300, rate: 0.12 },
    { limit: 201050, rate: 0.22 },
    { limit: 383900, rate: 0.24 },
    { limit: 487450, rate: 0.32 },
    { limit: 731200, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION = { single: 14600, married: 29200 };
const SE_TAX_RATE = 0.1530;      // 15.3% self-employment tax
const SE_TAX_CAP = 168600;       // SE tax applies to first $168,600 of trading income

/**
 * Estimates federal + self-employment tax for a trader who also has W-2
 * income (e.g. military base pay). Trading income is treated as
 * self-employment income; W-2 income is not subject to SE tax.
 * State tax is hardcoded to 0 (Tennessee has no income tax) — pass a
 * different rate if adapting this for another state.
 */
export function estimateTax({ armyIncome, tradingIncome, filingStatus }) {
  const totalIncome = armyIncome + tradingIncome;
  const standardDeduction = STANDARD_DEDUCTION[filingStatus] ?? STANDARD_DEDUCTION.single;
  const taxableIncome = Math.max(0, totalIncome - standardDeduction);

  let fedTax = 0, prev = 0;
  const brackets = FEDERAL_BRACKETS[filingStatus] ?? FEDERAL_BRACKETS.single;
  for (const bracket of brackets) {
    if (taxableIncome <= prev) break;
    const taxable = Math.min(taxableIncome, bracket.limit) - prev;
    fedTax += taxable * bracket.rate;
    prev = bracket.limit;
  }

  const seTax = tradingIncome > 0 ? Math.min(tradingIncome, SE_TAX_CAP) * SE_TAX_RATE : 0;
  const stateTax = 0; // Tennessee — no state income tax

  const totalTax = fedTax + seTax + stateTax;
  const effectiveRate = totalIncome > 0 ? (totalTax / totalIncome) * 100 : 0;
  const setAsideRate = totalIncome > 0 ? totalTax / totalIncome : 0;

  return {
    totalIncome, standardDeduction, taxableIncome,
    fedTax, seTax, stateTax, totalTax,
    effectiveRate, setAsideRate,
  };
}
