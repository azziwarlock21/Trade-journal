// ─── Trading Rules & Reference Data ───────────────────────────────────────
// Static content for the Rules tab: 5 rule categories (26 rules), the
// confluence score explanation, and the MAE reference guide. Kept as data
// (not JSX) so it can be reused in PDF reports (Phase 5) without a React
// dependency.

export const RULES = [
  {
    category: "Pre-Trade Checklist", color: "#3b82f6", icon: "CHECK",
    description: "Must meet ALL before entering a trade", checklist: true,
    rules: [
      { id: "r1", text: "HTF bias (Daily/4H) is clearly Bullish or Bearish — no trading in Ranging or Uncertain conditions until you have 200+ trades of data" },
      { id: "r2", text: "Entry is in a confirmed kill zone — London open (3-5 AM ET) or New York open (9:30-10:30 AM ET) only" },
      { id: "r3", text: "A clear candle pattern signal is present on your entry timeframe" },
      { id: "r4", text: "Stop loss is placed behind a structural level — a swing high/low, not a round number or arbitrary distance" },
      { id: "r5", text: "Risk/reward is at minimum 1:2 before entry — if the target does not offer at least 2x the risk, skip the trade" },
      { id: "r6", text: "No active high-impact news within 15 minutes of entry (CPI, NFP, FOMC, Powell speeches)" },
    ],
  },
  {
    category: "Risk Rules", color: "#ff4d6d", icon: "RISK",
    description: "Non-negotiable — follow these without exception", checklist: false,
    rules: [
      { id: "r7", text: "Maximum 1% of account risked per trade — no exceptions" },
      { id: "r8", text: "Maximum 2 trades open simultaneously" },
      { id: "r9", text: "3 consecutive losses = stop trading for the remainder of the week — no revenge trading, no exceptions" },
      { id: "r10", text: "Down 3% on the week = stop trading until Monday — protect capital above all else" },
      { id: "r11", text: "Never move your stop loss further away once a trade is live — you may move it to breakeven or tighter, never wider" },
      { id: "r12", text: "Never add to a losing position" },
    ],
  },
  {
    category: "Execution Rules", color: "#f5c842", icon: "EXEC",
    description: "Discipline at the point of entry and exit", checklist: false,
    rules: [
      { id: "r13", text: "Only trade pre-defined setup types — if you cannot name the setup before entry it does not qualify" },
      { id: "r14", text: "Do not enter a trade in the last 30 minutes before a scheduled high-impact news event" },
      { id: "r15", text: "Do not trade the first 5 minutes of any session open — wait for the initial volatility to settle and direction to show" },
      { id: "r16", text: "If you missed the entry, let it go — do not chase price more than 3-4 ticks from your planned entry" },
      { id: "r17", text: "Grade every trade A, B or C before you enter, not after — if it is a C setup, consider skipping it entirely" },
    ],
  },
  {
    category: "Post-Trade & Review", color: "#a78bfa", icon: "LOG",
    description: "How you learn and improve over time", checklist: false,
    rules: [
      { id: "r18", text: "Screenshot every trade immediately after closing — do not rely on memory" },
      { id: "r19", text: "Write your notes within 10 minutes of closing the trade while the reasoning is fresh" },
      { id: "r20", text: "Review your journal every Sunday — look at the week's trades, not individual days" },
      { id: "r21", text: "After every 50 trades, run a full analytics review — if your live win rate drops below 40% for 50+ trades, return to backtesting before continuing live" },
      { id: "r22", text: "Never change your system rules mid-week — write proposed changes down and implement on Monday only" },
    ],
  },
  {
    category: "Mindset Rules", color: "#00e5a0", icon: "MIND",
    description: "The mental edge that separates consistent traders", checklist: false,
    rules: [
      { id: "r23", text: "A loss is not a mistake if you followed your rules — a loss on a valid setup is the cost of doing business" },
      { id: "r24", text: "A win on a rule-breaking trade is more dangerous than a loss — it reinforces bad habits" },
      { id: "r25", text: "Your job is to execute the process, not predict the market — focus on did I follow my rules, not did I make money today" },
      { id: "r26", text: "Keep position sizing consistent — do not increase size after a winning streak or decrease out of fear after losses until you have 200+ live trades of data" },
    ],
  },
  {
    category: "Confluence Score — What Each Point Means", color: "#f97316", icon: "6/6",
    description: "The journal scores your setup 0–6 live as you fill in the form. Each point below is one confluence. Aim for 5–6 before entering.",
    checklist: false,
    rules: [
      { id: "c1", text: "HTF Bias is clear — Daily or 4H trend is set to Bullish or Bearish. Ranging or Uncertain = 0 points here. Trading against a clear bias is one of the most common reasons for avoidable losses." },
      { id: "c2", text: "Kill zone entry — Your entry time falls between 03:00–05:00 ET (London open) or 09:00–11:00 ET (New York open). These are the two highest-liquidity windows for GC. Entries outside these windows score 0 for this point." },
      { id: "c3", text: "Candle pattern present — A named pattern is selected on the form. A signal candle on your entry timeframe is required — a confluence without a trigger is not a trade, it is a guess." },
      { id: "c4", text: "Stop loss placed behind structure — Both entry price and stop loss are filled in with a real distance between them. A stop is not valid if it is a round number or arbitrary pip distance; it must sit behind a swing high or low." },
      { id: "c5", text: "RRR is at least 1:2 — The auto-calculated risk/reward ratio is 2.0 or higher. This is non-negotiable. If the target does not offer twice the risk, the setup does not qualify regardless of how good the signal looks." },
      { id: "c6", text: "News is clear — No high-impact event is detected within 30 minutes of your entry, or the news impact is Low. CPI, NFP, FOMC, and Powell speeches all score 0 here. The journal auto-detects these from the built-in calendar." },
    ],
  },
  {
    category: "MAE / MFE — Adverse & Favorable Excursion", color: "#a78bfa", icon: "MAE / MFE",
    description: "Two of the most underused metrics in retail trading — one shows how much heat you take before winning, the other shows how much profit you leave on the table. Both are now calculated automatically from actual market data; this section is about how to read them.",
    checklist: false,
    rules: [
      { id: "m1", text: "What MAE is — Max Adverse Excursion is how far price moved against you, in points, before the trade resolved. On a Long trade, it is the distance from your entry down to the lowest wick reached before price reversed or hit your stop. On a Short, it is the distance up to the highest wick." },
      { id: "m2", text: "How MAE is measured — The journal calculates this automatically from the actual 1-minute market data between your entry and exit, using the real lowest wick (Long) or highest wick (Short) — no manual entry needed." },
      { id: "m3", text: "What a low MAE on winning trades tells you — If your winners consistently show a MAE of 2–5 points, your entries are precise and price is moving in your direction almost immediately. This is the ideal. It means your timing and confluence are working." },
      { id: "m4", text: "What a high MAE on winning trades tells you — If price goes 15–20 points against you before eventually winning, your stop is wide enough to survive but your entry is early or imprecise. You are enduring unnecessary heat. Consider tightening your entry trigger or waiting for more confirmation." },
      { id: "m5", text: "What MAE on losing trades tells you — If your losses show a MAE equal to your full stop distance, price went straight to your stop without hesitation. This is normal and expected on invalid setups. If MAE on losses is consistently less than your stop, your stops may be too tight — you are getting stopped out before the trade had a chance to work." },
      { id: "m6", text: "The goal over 50+ trades — Your average MAE on winning trades should be significantly smaller than your stop size. If your average stop is 15 points and your average MAE on winners is 12 points, you are nearly getting stopped out on every winner. That is a sign to either widen stops slightly or improve entry precision." },
      { id: "m7", text: "What MFE is — Max Favorable Excursion is how far price moved in your favor, in points, before the trade resolved. On a Long, it is the distance from your entry up to the highest wick reached during the trade. On a Short, it is the distance down to the lowest wick. It answers a different question than P&L: not what you made, but what was actually available." },
      { id: "m8", text: "How MFE is measured — Same as MAE: calculated automatically from the real 1-minute bars between entry and exit, using the actual best price reached in your favor — not an estimate." },
      { id: "m9", text: "What a small gap between MFE and your realized points tells you — If a winning trade's MFE is 8 points and you captured 7 of them, your exit timing is efficient. You are taking profit close to where the move actually ran out." },
      { id: "m10", text: "What a large gap between MFE and your realized points tells you — If a winning trade's MFE was 20 points but you only captured 6, price moved strongly in your favor and gave much of it back before you exited. Repeated across many trades, this points to exiting too early, a take-profit placed too conservatively, or no plan for trailing a runner." },
      { id: "m11", text: "What MFE on a losing trade tells you — If a trade that ended as a loss shows a nonzero MFE, price was in your favor at some point before turning against you and hitting your stop. A consistent pattern of meaningful MFE on losers is a management problem, not just a setup problem — the trade was working and wasn't protected." },
      { id: "m12", text: "The goal over 50+ trades — Compare average MFE on winners to average points actually captured. A wide, consistent gap is the clearest signal in this journal that your exits — not your entries — are where edge is being left on the table." },
    ],
  },
];

export const ALL_CHECKLIST_IDS = RULES.find(s => s.checklist).rules.map(r => r.id);
