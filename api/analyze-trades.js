// ============================================================
// analyze-trades.js — Server-side Gemini trade-edge analysis.
// Replaces the previous OpenAI-based implementation (switched to Gemini
// for its genuinely free API tier — see project notes).
//
// Reuses the project's existing analytics.js (same functions the
// Analytics/PerformanceDashboard/ProfessionalStats tabs already use) to
// compute every deterministic statistic — win rate, profit factor,
// expectancy, drawdown, session/direction/weekday/hour/hold-time/news
// breakdowns, MAE/MFE excursion — server-side, so the model is reasoning
// over numbers this app already trusts rather than being asked to do the
// arithmetic itself.
//
// Plain REST call, no SDK — the Gemini API is a normal fetch()-able
// endpoint, so there's nothing to `npm install` for this one. The key
// lives ONLY here (process.env.GEMINI_API_KEY) — never in src/, never via
// a VITE_ variable, never called directly from the browser.
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
// Google retires/renames Gemini model IDs frequently (this endpoint was
// on gemini-2.5-flash until Google pulled it from new users ahead of its
// own published shutdown date). If this starts erroring with "no longer
// available", check https://ai.google.dev/gemini-api/docs/models for the
// current free-tier model name.
const MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const systemPrompt = `
You are an expert quantitative trading analyst.

Analyze the trader's actual historical completed trades and identify repeatable statistical edges.

Do NOT give generic motivational trading advice.
Do NOT invent statistics.
Do NOT claim causation from correlation.

Analyze:
- Win rate
- Profit factor
- Expectancy
- Average winner/loser
- Largest win/loss
- Direction
- Session
- Trade type
- Time of day
- Day of week
- R:R
- MAE
- MFE
- HTF bias
- Market structure
- Candle pattern
- News
- Execution grade
- Daily performance
- Weekly performance
- Any other available trade fields

Look for combinations of conditions that produce meaningful differences in performance.

Sample-size guidelines:
<10 trades = insufficient
10-19 = very weak evidence
20-29 = interesting but requires validation
30+ = more meaningful
50+ = stronger evidence

For every important finding, include the sample size.

Return:

EXECUTIVE SUMMARY

STRONGEST EDGES

WEAKEST CONDITIONS

BEST SETUPS

WORST SETUPS

SESSION ANALYSIS

DIRECTION ANALYSIS

TIME-OF-DAY ANALYSIS

R:R ANALYSIS

MAE/MFE ANALYSIS

RECOMMENDED TESTS

IMPORTANT DATA LIMITATIONS

Focus on discovering repeatable edges from the trader's actual data.
`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (CRON_SECRET) {
    const authHeader = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (authHeader !== CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on the server" });
  }

  try {
    const { trades, stats } = req.body;

    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ error: "No trades supplied" });
    }

    const userPrompt = `
Analyze these completed trades.

Number of trades:
${trades.length}

Calculated statistics:
${JSON.stringify(stats || {}, null, 2)}

Trade data:
${JSON.stringify(trades, null, 2)}
`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }),
    });

    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      throw new Error(data?.error?.message || `Gemini API error (${geminiRes.status})`);
    }

    const analysis = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || "").join("\n").trim();

    if (!analysis) {
      const blockReason = data.promptFeedback?.blockReason;
      throw new Error(blockReason ? `Gemini blocked the request: ${blockReason}` : "Gemini returned an empty response");
    }

    return res.status(200).json({ success: true, analysis });
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return res.status(500).json({
      error: error.message || "Gemini analysis failed",
    });
  }
}
