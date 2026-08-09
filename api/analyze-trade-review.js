// ============================================================
// analyze-trade-review.js — Server-side OpenAI per-trade review
// (chart screenshots + trade data -> structured coaching feedback).
//
// Companion to api/analyze-trades.js (which handles the full-history
// Trading Edge report) — this one reviews a single trade, using OpenAI's
// vision input when screenshots are attached. Same key-handling rules:
// OPENAI_API_KEY lives only here, never in client code.
// ============================================================

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CRON_SECRET = process.env.CRON_SECRET || "";
const MODEL = "gpt-5.4";

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
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY not configured on the server" });
  }

  try {
    const { prompt, images } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const content = [{ type: "input_text", text: prompt }];
    for (const dataUrl of images || []) {
      content.push({ type: "input_image", image_url: dataUrl });
    }

    const response = await openai.responses.create({
      model: MODEL,
      input: [{ role: "user", content }],
    });

    return res.status(200).json({ success: true, text: response.output_text });
  } catch (error) {
    console.error("OpenAI trade review error:", error);
    return res.status(500).json({ error: error.message || "OpenAI review failed" });
  }
}
