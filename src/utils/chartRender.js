// ─── chartRender.js ─────────────────────────────────────────────────────
// Deterministic candlestick chart renderer for trade reconstruction.
//
// IMPORTANT: this draws exactly what it's given. Entry/exit position comes
// from the trade's own exact fill price + timestamp (matched to the
// nearest historical bar), never estimated or guessed from candle shape.
// No AI involved — see project chart-reconstruction notes.

const COLORS = {
  bg: "#0d1117",
  panel: "#0b0f14",
  grid: "#1f2937",
  axisText: "#6b7280",
  candleUp: "#00e5a0",
  candleDown: "#ff4d6d",
  entryLine: "#3b82f6",
  exitLine: "#e6edf3",
  slLine: "#ff4d6d",
  tpLine: "#00e5a0",
  regionFill: "rgba(245, 200, 66, 0.06)",
  hudBg: "rgba(13, 17, 23, 0.88)",
  hudBorder: "#2a2f3a",
  text: "#e6edf3",
  subtext: "#9ca3af",
};

function contractPointValue(contractId) {
  return (contractId || "").includes("MGC") ? 10 : 100;
}

// Find the bar index whose [time, time+1min) window contains `targetIso`,
// falling back to the nearest bar if the exact minute isn't in the data
// (e.g. a fill during a data gap).
function nearestBarIndex(bars, targetIso) {
  const target = new Date(targetIso).getTime();
  if (isNaN(target) || !bars.length) return -1;

  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < bars.length; i++) {
    const t = new Date(bars[i].time).getTime();
    const diff = Math.abs(t - target);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

/**
 * Render a deterministic 1-minute reconstruction chart for a trade.
 *
 * @param {Object} params
 * @param {Array}  params.bars   - [{time, open, high, low, close, volume}] ascending
 * @param {Object} params.trade  - trade object (camelCase fields from db.js)
 * @param {String} params.timeframe - "1m" | "5m" | "15m" (label only, phase 1 = "1m")
 * @param {Number} [params.width]
 * @param {Number} [params.height]
 * @returns {{ dataUrl: string, entryIndex: number, exitIndex: number }}
 */
export function renderTradeChart({ bars, trade, timeframe = "1m", width = 1100, height = 620 }) {
  if (!bars || !bars.length) throw new Error("No bars to render");

  const sorted = [...bars].sort((a, b) => new Date(a.time) - new Date(b.time));

  const entryPrice = parseFloat(trade.entryPrice);
  const exitPrice = parseFloat(trade.takeProfit); // TSX-imported trades store actual exit fill price here (see buildTrade notes)
  const stopLoss = parseFloat(trade.stopLoss);
  const takeProfitTarget = parseFloat(trade.takeProfit);
  const isLong = trade.direction === "Long";

  const entryIndex = nearestBarIndex(sorted, trade.entryDatetimeUtc);
  const exitIndex = nearestBarIndex(sorted, trade.exitDatetimeUtc);

  // ── Canvas setup (2x for crisp export) ──
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  const marginLeft = 20;
  const marginRight = 90;
  const marginTop = 130; // room for HUD
  const marginBottom = 46;
  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;

  // ── Price range (include SL/TP/entry/exit so lines are always visible) ──
  const highs = sorted.map(b => b.high);
  const lows = sorted.map(b => b.low);
  const extra = [entryPrice, exitPrice, stopLoss, takeProfitTarget].filter(v => !isNaN(v));
  let maxP = Math.max(...highs, ...extra);
  let minP = Math.min(...lows, ...extra);
  const pad = (maxP - minP) * 0.08 || 1;
  maxP += pad;
  minP -= pad;

  const priceToY = (p) => marginTop + chartH - ((p - minP) / (maxP - minP)) * chartH;

  const n = sorted.length;
  const slot = chartW / n;
  const candleW = Math.max(2, Math.min(10, slot * 0.62));
  const xAt = (i) => marginLeft + i * slot + slot / 2;

  // ── Grid + price axis ──
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.font = "11px 'SF Mono', Menlo, monospace";
  ctx.fillStyle = COLORS.axisText;
  const gridLines = 6;
  for (let i = 0; i <= gridLines; i++) {
    const p = minP + ((maxP - minP) * i) / gridLines;
    const y = priceToY(p);
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft + chartW, y);
    ctx.stroke();
    ctx.fillText(p.toFixed(1), marginLeft + chartW + 10, y + 4);
  }

  // ── Trade-duration highlighted region ──
  if (entryIndex >= 0 && exitIndex >= 0) {
    const x1 = marginLeft + entryIndex * slot;
    const x2 = marginLeft + (exitIndex + 1) * slot;
    ctx.fillStyle = COLORS.regionFill;
    ctx.fillRect(x1, marginTop, x2 - x1, chartH);
  }

  // ── Candlesticks ──
  sorted.forEach((b, i) => {
    const x = xAt(i);
    const up = b.close >= b.open;
    ctx.strokeStyle = ctx.fillStyle = up ? COLORS.candleUp : COLORS.candleDown;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, priceToY(b.high));
    ctx.lineTo(x, priceToY(b.low));
    ctx.stroke();
    const oY = priceToY(b.open);
    const cY = priceToY(b.close);
    const top = Math.min(oY, cY);
    const h = Math.max(1, Math.abs(cY - oY));
    ctx.fillRect(x - candleW / 2, top, candleW, h);
  });

  // ── Time axis (a handful of labels) ──
  ctx.fillStyle = COLORS.axisText;
  const labelCount = Math.min(8, n);
  for (let k = 0; k <= labelCount; k++) {
    const i = Math.round((k / labelCount) * (n - 1));
    const t = new Date(sorted[i].time);
    const label = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" });
    ctx.fillText(label, xAt(i) - 14, height - marginBottom + 18);
  }

  // ── SL / TP horizontal lines ──
  function dashedLine(price, color, label) {
    if (isNaN(price)) return;
    const y = priceToY(price);
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft + chartW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = "bold 10px 'SF Mono', Menlo, monospace";
    ctx.fillText(label, marginLeft + chartW + 10, y - 5);
  }

  dashedLine(stopLoss, COLORS.slLine, "SL " + (isNaN(stopLoss) ? "" : stopLoss.toFixed(1)));
  // Only draw a separate TP line when it differs from the actual exit —
  // for TopstepX-imported trades, takeProfit IS the exit fill, so drawing
  // both would just be two identical lines.
  if (!isNaN(takeProfitTarget) && Math.abs(takeProfitTarget - exitPrice) > 0.001) {
    dashedLine(takeProfitTarget, COLORS.tpLine, "TP " + takeProfitTarget.toFixed(1));
  }
  dashedLine(entryPrice, COLORS.entryLine, "Entry " + (isNaN(entryPrice) ? "" : entryPrice.toFixed(1)));
  dashedLine(exitPrice, COLORS.exitLine, "Exit " + (isNaN(exitPrice) ? "" : exitPrice.toFixed(1)));

  // ── Entry / exit markers ──
  function marker(index, price, kind) {
    if (index < 0 || isNaN(price)) return;
    const x = xAt(index);
    const y = priceToY(price);
    const arrowUp = (kind === "entry") ? isLong : !isLong; // long entry / short exit point up; short entry / long exit point down
    ctx.fillStyle = kind === "entry" ? COLORS.entryLine : COLORS.exitLine;
    ctx.beginPath();
    const s = 7;
    if (arrowUp) {
      ctx.moveTo(x, y - s); ctx.lineTo(x - s, y + s); ctx.lineTo(x + s, y + s);
    } else {
      ctx.moveTo(x, y + s); ctx.lineTo(x - s, y - s); ctx.lineTo(x + s, y - s);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  marker(entryIndex, entryPrice, "entry");
  marker(exitIndex, exitPrice, "exit");

  // ── HUD (top-left trade info box) ──
  const pv = contractPointValue(trade.contractId);
  const points = parseFloat(trade.points);
  const pnl = !isNaN(points) ? points * pv * (parseFloat(trade.lotSize) || 1) : null;
  const duration = (() => {
    if (!trade.entryDatetimeUtc || !trade.exitDatetimeUtc) return "--";
    const diffMin = Math.round((new Date(trade.exitDatetimeUtc) - new Date(trade.entryDatetimeUtc)) / 60000);
    return diffMin >= 60 ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `${diffMin}m`;
  })();
  const etFmt = (iso) => iso ? new Date(iso).toLocaleString("en-US", {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York",
  }) : "--";

  const hudX = marginLeft, hudY = 14, hudW = 430, hudH = 100;
  ctx.fillStyle = COLORS.hudBg;
  ctx.strokeStyle = COLORS.hudBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(hudX, hudY, hudW, hudH, 8) : ctx.rect(hudX, hudY, hudW, hudH);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 15px -apple-system, Segoe UI, sans-serif";
  ctx.fillStyle = isLong ? COLORS.candleUp : COLORS.candleDown;
  ctx.fillText(`${trade.direction || "--"} · ${timeframe}`, hudX + 14, hudY + 24);

  ctx.font = "12px -apple-system, Segoe UI, sans-serif";
  ctx.fillStyle = COLORS.text;
  const pnlColor = pnl == null ? COLORS.subtext : pnl >= 0 ? COLORS.candleUp : COLORS.candleDown;
  ctx.fillText(`P&L: `, hudX + 14, hudY + 44);
  ctx.fillStyle = pnlColor;
  ctx.fillText(pnl == null ? "--" : `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${points >= 0 ? "+" : ""}${points}pts)`, hudX + 50, hudY + 44);

  ctx.fillStyle = COLORS.subtext;
  ctx.fillText(`Contracts: ${trade.lotSize || "--"}   Session: ${trade.session || "--"}   Duration: ${duration}`, hudX + 14, hudY + 62);
  ctx.fillText(`Entry: ${etFmt(trade.entryDatetimeUtc)} ET   Exit: ${etFmt(trade.exitDatetimeUtc)} ET`, hudX + 14, hudY + 80);

  // ── Watermark ──
  ctx.font = "10px -apple-system, Segoe UI, sans-serif";
  ctx.fillStyle = COLORS.subtext;
  ctx.textAlign = "right";
  ctx.fillText("Reconstructed from TopstepX OHLCV — deterministic, no AI", width - 12, height - 8);
  ctx.textAlign = "left";

  return {
    dataUrl: canvas.toDataURL("image/png"),
    entryIndex,
    exitIndex,
    barCount: n,
  };
}
