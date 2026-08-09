// ============================================================
// ai-coach.js — Server-side proxy for Claude API calls used by the
// AI Coach tab (per-trade review + full-history Trading Edge report).
//
// The client can't call api.anthropic.com directly: the API requires an
// x-api-key header (which must never be exposed in browser code) and
// doesn't allow direct cross-origin browser requests. This mirrors the
// same pattern already used for TopstepX (api/sync-topstepx.js,
// api/get-trade-bars.js) — the secret lives only on the server, the
// client sends a request body and gets back Claude's response.
// ============================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET || "";
const MODEL = "claude-sonnet-4-5-20250929";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  if (CRON_SECRET) {
    const authHeader = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (authHeader !== CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on the server" });
  }

  try {
    const { messages, system, max_tokens = 1500 } = req.body || {};
    if (!messages) return res.status(400).json({ error: "messages is required" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens,
        ...(system ? { system } : {}),
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Claude API error (${response.status})`);
    }

    const text = (data.content || []).map(b => b.text || "").join("\n").trim();
    return res.status(200).json({ success: true, text });
  } catch (error) {
    console.error("ai-coach error:", error);
    return res.status(500).json({ error: error.message });
  }
}
