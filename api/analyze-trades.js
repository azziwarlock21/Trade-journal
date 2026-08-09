// ============================================================
// analyze-trades.js — Server-side OpenAI trade-edge analysis.
// Replaces the previous Anthropic/Claude-based implementation.
//
// Reuses the project's existing analytics.js (same functions the
// Analytics/PerformanceDashboard/ProfessionalStats tabs already use) to
// compute every deterministic statistic — win rate, profit factor,
// expectancy, drawdown, session/direction/weekday/hour/hold-time/news
// breakdowns, MAE/MFE excursion — server-side, so the model is reasoning
// over numbers this app already trusts rather than being asked to do the
// arithmetic itself.
//
// The OpenAI key lives ONLY here (process.env.OPENAI_API_KEY) — never in
// src/, never via a VITE_ variable, never called directly from the browser.
// ============================================================

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CRON_SECRET = process.env.CRON_SECRET || "";
const MODEL = "gpt-5.4";

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

  // Same lightweight bearer-secret convention as every other endpoint in
  // this project (sync-topstepx.js, get-trade-bars.js) — not in the
  // original spec's example, added so this can't be hit anonymously and
  // run up your OpenAI bill. The client sends VITE_CRON_SECRET the same
  // way it already does for the TopstepX endpoints.
  if (CRON_SECRET) {
    const authHeader = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (authHeader !== CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not configured on the server" });
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

    const response = await openai.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    return res.status(200).json({
      success: true,
      analysis: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI analysis error:", error);
    return res.status(500).json({
      error: error.message || "OpenAI analysis failed",
    });
  }
}
