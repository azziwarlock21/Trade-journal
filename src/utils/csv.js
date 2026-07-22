import { defaultForm } from "./helpers.js";
import { dbInsert, dbFetchAll } from "../api/db.js";

// ─── CSV Import / Export ──────────────────────────────────────────────────

export function exportTradesCSV(trades) {
  const headers = Object.keys(defaultForm()).filter(k => k !== "screenshots");
  const rows = trades.map(t => headers.map(h => JSON.stringify(t[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "gc_trades.csv";
  a.click();
}

/**
 * Reads a CSV File, inserts each row as a new trade, then returns the
 * refreshed trade list. Caller is responsible for updating React state
 * and any loading/error UI.
 */
export function importTradesCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const lines = ev.target.result.split("\n").filter(Boolean);
        const headers = lines[0].split(",");
        const imported = lines.slice(1).map((line, i) => {
          const vals = line.match(/(\".*?\"|[^,]+)/g) || [];
          const obj = {};
          headers.forEach((h, idx) => {
            try { obj[h] = JSON.parse(vals[idx] || "null"); }
            catch (e) { obj[h] = vals[idx] || ""; }
          });
          obj.id = Date.now() + i;
          return obj;
        });

        if (!window.confirm(`Import ${imported.length} trades? This ADDS to existing trades.`)) {
          resolve(null);
          return;
        }

        for (const t of imported) await dbInsert(t);
        const fresh = await dbFetchAll();
        resolve(fresh);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
