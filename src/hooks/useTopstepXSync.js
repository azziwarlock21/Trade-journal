import { useState, useCallback } from "react";
import { dbFetchAll } from "../api/db.js";

// ─── useTopstepXSync ──────────────────────────────────────────────────────
// Triggers the /api/sync-topstepx serverless function. `VITE_CRON_SECRET`
// must be set in both Vercel env vars and the local .env file (Vite only
// exposes VITE_-prefixed vars to the browser bundle).
//
// resetSync=true clears the sync_log timestamp server-side, forcing a full
// re-import of trade history — used by the "TSX Full" button.

export function useTopstepXSync(setTrades) {
  const [syncStatus, setSyncStatus] = useState(null); // { synced, from, to, error }
  const [syncRunning, setSyncRunning] = useState(false);

  const triggerSync = useCallback(async (resetSync = false) => {
    setSyncRunning(true); setSyncStatus(null);
    try {
      const secret = import.meta.env.VITE_CRON_SECRET || "";
      const base = window.location.origin;
      const res = await fetch(`${base}/api/sync-topstepx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
        body: JSON.stringify(resetSync ? { resetSync: true } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSyncStatus({ synced: data.synced, from: data.from, to: data.to, error: null });
      if (data.synced > 0) {
        const fresh = await dbFetchAll();
        setTrades(fresh);
      }
    } catch (e) {
      setSyncStatus({ synced: 0, error: e.message });
    } finally {
      setSyncRunning(false);
    }
  }, [setTrades]);

  // Wipes every TopstepX-imported (Live) trade and plants a new epoch-start
  // floor server-side, so a blown-then-reactivated account starts clean and
  // no future sync — including "TSX Full" — can pull its old fills back in.
  const reactivateAccount = useCallback(async () => {
    setSyncRunning(true); setSyncStatus(null);
    try {
      const secret = import.meta.env.VITE_CRON_SECRET || "";
      const base = window.location.origin;
      const res = await fetch(`${base}/api/sync-topstepx`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secret}` },
        body: JSON.stringify({ reactivate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reactivate failed");
      const fresh = await dbFetchAll();
      setTrades(fresh);
      setSyncStatus({ synced: 0, error: null, reactivated: true });
    } catch (e) {
      setSyncStatus({ synced: 0, error: e.message });
    } finally {
      setSyncRunning(false);
    }
  }, [setTrades]);

  return { syncStatus, setSyncStatus, syncRunning, triggerSync, reactivateAccount };
}
