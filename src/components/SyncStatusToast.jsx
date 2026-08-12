// ─── SyncStatusToast ──────────────────────────────────────────────────────
// Dismissible banner showing the result of the last TopstepX sync attempt.

export default function SyncStatusToast({ syncStatus, onDismiss }) {
  if (!syncStatus) return null;

  return (
    <div style={{ background: syncStatus.error ? "rgba(255,77,109,0.08)" : "rgba(0,229,160,0.06)", borderBottom: `1px solid ${syncStatus.error ? "#ff4d6d33" : "#00e5a033"}`, padding: "7px 24px", display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
      {syncStatus.error ? (
        <>
          <span style={{ color: "#ff4d6d", fontWeight: 700 }}>✕ Sync failed:</span>
          <span style={{ color: "#9ca3af" }}>{syncStatus.error}</span>
        </>
      ) : syncStatus.reactivated ? (
        <>
          <span style={{ color: "#00e5a0", fontWeight: 700 }}>✓ Account reactivated</span>
          <span style={{ color: "#9ca3af" }}>old trades cleared — journal starts fresh from here</span>
        </>
      ) : (
        <>
          <span style={{ color: "#00e5a0", fontWeight: 700 }}>✓ TopstepX synced</span>
          <span style={{ color: "#9ca3af" }}>{syncStatus.synced} new trade{syncStatus.synced !== 1 ? "s" : ""} imported</span>
          {syncStatus.synced === 0 && <span style={{ color: "#4b5563" }}>— no new fills since last sync</span>}
        </>
      )}
      <button onClick={onDismiss} style={{ marginLeft: "auto", fontSize: 11, color: "#4b5563", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
    </div>
  );
}
