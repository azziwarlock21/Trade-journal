// ============================================================
// analyze-trade-review.js — Server-side Gemini per-trade review
// (chart screenshots + trade data -> structured coaching feedback).
//
// Companion to api/analyze-trades.js (full-history Trading Edge report) —
// this one reviews a single trade, using Gemini's native image
// understanding when screenshots are attached. Gemini's free tier
// supports vision fully (unlike OpenAI's, which drops to text-only
// without billing enabled), which is why this moved off OpenAI.
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

// Splits a "data:image/jpeg;base64,AAAA..." URL into the pieces Gemini's
// inline_data part wants. Falls back to image/jpeg if the data URL is
// missing a mime type for some reason.
function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || "");
  if (match) return { mimeType: match[1], data: match[2] };
  return { mimeType: "image/jpeg", data: dataUrl || "" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (CRON_SECRET) {
    const authHeader = (req.headers.authorization || "").replace("Bearer ", "").trim();
    if (authHeader !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
  }
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured on the server" });
  }

  try {
    const { prompt, images } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const parts = [{ text: prompt }];
    for (const dataUrl of images || []) {
      const { mimeType, data } = parseDataUrl(dataUrl);
      parts.push({ inline_data: { mime_type: mimeType, data } });
    }

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    });

    const data = await geminiRes.json();
    if (!geminiRes.ok) {
      throw new Error(data?.error?.message || `Gemini API error (${geminiRes.status})`);
    }

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || "").join("\n").trim();

    if (!text) {
      const blockReason = data.promptFeedback?.blockReason;
      throw new Error(blockReason ? `Gemini blocked the request: ${blockReason}` : "Gemini returned an empty response");
    }

    return res.status(200).json({ success: true, text });
  } catch (error) {
    console.error("Gemini trade review error:", error);
    return res.status(500).json({ error: error.message || "Gemini review failed" });
  }
}
