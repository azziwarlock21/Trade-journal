// ─── AI Coach — Pattern Analysis Engine ───────────────────────────────────
// Pure data-driven findings generator (no API call). Scans the full trade
// history for win rate, session/pattern performance, execution gaps, HTF
// alignment, MAE, grading calibration, RRR, and loss streaks — then returns
// a list of { type, title, body } findings for the Analytics panel to
// render. Kept separate from the Claude API review (coachReview.js) since
// this one is instant and free, no network call required.

export function runDataAnalysis(trades) {
  const src = trades;
  const wins = src.filter(t => t.outcome === "Win");
  const losses = src.filter(t => t.outcome === "Loss");
  const wr = wins.length / src.length;

  const bySess = {};
  src.forEach(t => {
    if (!t.session) return;
    if (!bySess[t.session]) bySess[t.session] = { w: 0, l: 0 };
    t.outcome === "Win" ? bySess[t.session].w++ : bySess[t.session].l++;
  });
  const sessRanked = Object.entries(bySess)
    .map(([s, d]) => ({ s, wr: d.w / (d.w + d.l), total: d.w + d.l }))
    .sort((a, b) => b.wr - a.wr);

  const byCandle = {};
  src.forEach(t => {
    if (!t.candlePattern || t.candlePattern === "None") return;
    if (!byCandle[t.candlePattern]) byCandle[t.candlePattern] = { w: 0, l: 0 };
    t.outcome === "Win" ? byCandle[t.candlePattern].w++ : byCandle[t.candlePattern].l++;
  });
  const candleRanked = Object.entries(byCandle)
    .map(([c, d]) => ({ c, wr: d.w / (d.w + d.l), total: d.w + d.l }))
    .sort((a, b) => b.wr - a.wr);

  const aSetupPoorExec = src.filter(t => t.grade === "A" && t.executionGrade && t.executionGrade !== "A" && t.executionGrade !== "Ungraded").length;
  const aSetupAExec = src.filter(t => t.grade === "A" && t.executionGrade === "A").length;

  const tradesWithMAE = src.filter(t => t.mae);
  const winnerMAE = tradesWithMAE.filter(t => t.outcome === "Win");
  const avgWinMAE = winnerMAE.length
    ? (winnerMAE.reduce((a, t) => a + parseFloat(t.mae), 0) / winnerMAE.length).toFixed(1)
    : null;

  const byGrade = {};
  src.forEach(t => {
    if (!byGrade[t.grade]) byGrade[t.grade] = { w: 0, total: 0 };
    byGrade[t.grade].total++;
    if (t.outcome === "Win") byGrade[t.grade].w++;
  });

  const aligned = src.filter(t => (t.direction === "Long" && t.htfBias === "Bullish") || (t.direction === "Short" && t.htfBias === "Bearish"));
  const misaligned = src.filter(t => (t.direction === "Long" && t.htfBias === "Bearish") || (t.direction === "Short" && t.htfBias === "Bullish"));
  const alignedWR = aligned.length ? (aligned.filter(t => t.outcome === "Win").length / aligned.length * 100).toFixed(0) : null;
  const misalignedWR = misaligned.length ? (misaligned.filter(t => t.outcome === "Win").length / misaligned.length * 100).toFixed(0) : null;

  const avgRRRWins = wins.length
    ? (wins.reduce((a, t) => a + (parseFloat(t.rrr) || 0), 0) / wins.length).toFixed(2)
    : null;

  let maxLossStreak = 0, curLS = 0;
  [...src].sort((a, b) => (a.entryDatetime < b.entryDatetime ? -1 : 1)).forEach(t => {
    if (t.outcome === "Loss") { curLS++; maxLossStreak = Math.max(maxLossStreak, curLS); }
    else curLS = 0;
  });

  const findings = [];

  if (wr >= 0.6) {
    findings.push({ type: "positive", title: "Strong win rate", body: `Your win rate is ${(wr * 100).toFixed(1)}% across ${src.length} trades — above the 60% threshold for a statistically significant edge. Keep protecting it.` });
  } else if (wr >= 0.45) {
    findings.push({ type: "warning", title: "Win rate needs improvement", body: `Win rate is ${(wr * 100).toFixed(1)}%. You need 55%+ to grow consistently at 2.0 RRR. Focus on skipping C-grade setups and only trading in your best sessions.` });
  } else {
    findings.push({ type: "critical", title: "Win rate is below breakeven", body: `Win rate is ${(wr * 100).toFixed(1)}%. You are losing money at this level. Return to backtesting and do not go live until this is above 50% over 50+ trades.` });
  }

  if (sessRanked.length >= 2) {
    const best = sessRanked[0], worst = sessRanked[sessRanked.length - 1];
    if (best.total >= 3) findings.push({ type: "positive", title: `Best session: ${best.s}`, body: `${(best.wr * 100).toFixed(0)}% win rate in ${best.s} (${best.total} trades). This is your strongest window — prioritise entries here.` });
    if (worst.total >= 3 && worst.wr < 0.4) findings.push({ type: "critical", title: `Avoid: ${worst.s}`, body: `Only ${(worst.wr * 100).toFixed(0)}% win rate in ${worst.s} across ${worst.total} trades. This session is costing you money — consider eliminating it entirely.` });
  }

  if (candleRanked.length >= 2) {
    const best = candleRanked[0], worst = candleRanked[candleRanked.length - 1];
    if (best.total >= 3) findings.push({ type: "positive", title: `Best pattern: ${best.c}`, body: `${best.c} wins ${(best.wr * 100).toFixed(0)}% of the time over ${best.total} trades. Weight your entries toward this signal.` });
    if (worst.total >= 3 && worst.wr < 0.4) findings.push({ type: "warning", title: `Weak pattern: ${worst.c}`, body: `${worst.c} only wins ${(worst.wr * 100).toFixed(0)}% across ${worst.total} trades. Refine how you identify it or stop trading it.` });
  }

  if (aSetupPoorExec > 0) {
    const pct = ((aSetupPoorExec / (aSetupPoorExec + aSetupAExec || 1)) * 100).toFixed(0);
    findings.push({ type: "warning", title: "Execution gap on A setups", body: `${pct}% of your A-grade setups had poor execution. You are identifying good trades but not managing them cleanly — common causes are chasing entry, moving SL, or exiting early.` });
  }

  if (alignedWR && misalignedWR && misaligned.length >= 3) {
    findings.push({
      type: parseInt(misalignedWR) < 40 ? "critical" : "warning",
      title: "Counter-trend trades underperforming",
      body: `With-trend trades win ${alignedWR}%. Counter-trend trades win only ${misalignedWR}% across ${misaligned.length} trades. ${parseInt(misalignedWR) < 40 ? "Stop trading against the HTF trend entirely." : "Reduce counter-trend frequency and require higher confluence for those entries."}`,
    });
  }

  if (avgWinMAE) {
    if (parseFloat(avgWinMAE) > 8) findings.push({ type: "warning", title: "High heat on winning trades", body: `Average MAE on winners is ${avgWinMAE} points. Your entries are slightly early — price moves against you before recovering. Wait for stronger confirmation before entering.` });
    else if (parseFloat(avgWinMAE) <= 4) findings.push({ type: "positive", title: "Tight entry precision", body: `Average MAE on winners is only ${avgWinMAE} points — price moves in your direction almost immediately. Your timing and triggers are working.` });
  }

  const aGrade = byGrade["A"], cGrade = byGrade["C"];
  if (aGrade && cGrade && aGrade.total >= 3 && cGrade.total >= 3) {
    const aWR = (aGrade.w / aGrade.total * 100).toFixed(0);
    const cWR = (cGrade.w / cGrade.total * 100).toFixed(0);
    if (parseInt(aWR) > parseInt(cWR) + 15) findings.push({ type: "positive", title: "Grading is calibrated", body: `A-grade setups win ${aWR}% vs C-grade at ${cWR}%. Your pre-trade grading accurately identifies quality — keep skipping C setups.` });
    else if (parseInt(aWR) <= parseInt(cWR)) findings.push({ type: "warning", title: "Grading is not predictive yet", body: `A-grade wins ${aWR}% vs C-grade at ${cWR}%. Your grading isn't differentiating quality — tighten the criteria for what qualifies as an A setup.` });
  }

  if (avgRRRWins) {
    if (parseFloat(avgRRRWins) < 1.8) findings.push({ type: "critical", title: "RRR on wins is too low", body: `Average RRR on winning trades is ${avgRRRWins}. You need at least 2.0 to grow at your target win rate. You may be exiting winners early — let price reach TP.` });
    else if (parseFloat(avgRRRWins) >= 2.3) findings.push({ type: "positive", title: "Strong RRR on winners", body: `Average RRR on wins is ${avgRRRWins} — above the 2.0 minimum. You are not cutting winners short.` });
  }

  if (maxLossStreak >= 3) {
    findings.push({ type: "warning", title: `Max loss streak: ${maxLossStreak}`, body: `You have had ${maxLossStreak} consecutive losses. Per your rules, 3 in a row means stop for the rest of the week. Review whether these were valid setups or rule breaks.` });
  }

  return findings;
}
