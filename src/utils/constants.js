// ─── Trading Constants ───────────────────────────────────────────────────────

export const CANDLE_PATTERNS = ["None", "Engulfing Bull", "Engulfing Bear", "Hammer", "Doji", "Pin Bar", "Other"];
export const NEWS_EVENTS = ["None", "CPI", "NFP", "FOMC", "PPI", "GDP", "ISM", "Retail Sales", "Unemployment Claims", "Jerome Powell Speech", "Other"];
export const SESSIONS = ["London", "New York", "Asia", "London/NY Overlap", "Pre-Market", "After Hours"];
export const DIRECTIONS = ["Long", "Short"];
export const TRADE_TYPES = ["Supply and Demand", "Breakout", "Reversal", "Range", "Break and Retest", "News Play"];
export const GRADES = ["A", "B", "C", "Ungraded"];
export const HTF_BIASES = ["Bullish", "Bearish", "Ranging", "Uncertain"];
export const MARKET_STRUCTURES = ["With Trend", "Counter Trend", "Range", "Breakout", "Reversal"];
export const TRADE_MODES = ["Backtest", "Paper", "Live"];
export const TIMEZONES = [
  { label: "New York (ET)", tz: "America/New_York" },
];
