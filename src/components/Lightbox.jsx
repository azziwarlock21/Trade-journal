import { useState, useRef } from "react";

// ─── Lightbox ─────────────────────────────────────────────────────────────
// Full-screen image viewer for chart screenshots. Tap image to close (when
// not zoomed), scroll wheel to zoom, click-drag or touch-drag to pan,
// double-tap/double-click to toggle between 1x and 2.5x zoom.
//
// Props:
//   src      - image data URL, or null to hide the lightbox
//   onClose  - () => void

export default function Lightbox({ src, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const pinchRef = useRef({ pinching: false, startDist: 0, startZoom: 1 });
  const lastTap = useRef(0);

  if (!src) return null;

  const close = () => { onClose(); setZoom(1); setOffset({ x: 0, y: 0 }); };

  const touchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom(z => Math.min(Math.max(z + delta, 0.5), 8));
  };

  const handleImgClick = (e) => {
    e.stopPropagation();
    const now = Date.now();
    const since = now - lastTap.current;
    lastTap.current = now;
    if (since < 300) {
      setZoom(z => (z > 1.2 ? 1 : 2.5));
      setOffset({ x: 0, y: 0 });
    } else if (zoom <= 1.05) {
      close();
    }
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current.dragging) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    });
  };
  const handleMouseUp = () => { dragRef.current.dragging = false; };

  // Two-finger pinch to zoom, single-finger drag to pan. Pinch takes
  // priority the moment a second finger lands; dropping back to one
  // finger resumes panning from wherever the pinch left off.
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      dragRef.current.dragging = false;
      pinchRef.current = { pinching: true, startDist: touchDist(e.touches), startZoom: zoom };
    } else if (e.touches.length === 1) {
      pinchRef.current.pinching = false;
      dragRef.current = { dragging: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, ox: offset.x, oy: offset.y };
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current.pinching) {
      e.preventDefault();
      const dist = touchDist(e.touches);
      const scale = dist / (pinchRef.current.startDist || dist);
      setZoom(Math.min(Math.max(pinchRef.current.startZoom * scale, 0.5), 8));
    } else if (e.touches.length === 1 && dragRef.current.dragging) {
      e.preventDefault();
      setOffset({
        x: dragRef.current.ox + (e.touches[0].clientX - dragRef.current.startX),
        y: dragRef.current.oy + (e.touches[0].clientY - dragRef.current.startY),
      });
    }
  };
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current.pinching = false;
    if (e.touches.length === 1) {
      // Resume single-finger panning from the finger that's still down.
      dragRef.current = { dragging: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, ox: offset.x, oy: offset.y };
    } else if (e.touches.length === 0) {
      dragRef.current.dragging = false;
    }
  };

  const zoomIn = (e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.5, 8)); };
  const zoomOut = (e) => {
    e.stopPropagation();
    setZoom(z => { const nz = Math.max(z - 0.5, 0.5); if (nz <= 1) setOffset({ x: 0, y: 0 }); return nz; });
  };
  const resetZoom = (e) => { e.stopPropagation(); setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div
      onClick={close}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: zoom > 1 ? "grab" : "zoom-out", userSelect: "none", touchAction: "none",
      }}>

      {/* Controls */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)", zIndex: 10000 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={zoomOut} style={ctrlBtn}>−</button>
          <span onClick={resetZoom} style={zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button onClick={zoomIn} style={ctrlBtn}>+</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#4b5563" }}>{zoom <= 1.05 ? "tap image to close" : "double-tap to reset"}</span>
          <button onClick={(e) => { e.stopPropagation(); close(); }} style={ctrlBtn}>×</button>
        </div>
      </div>

      <img
        src={src}
        alt="chart"
        onClick={handleImgClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        draggable={false}
        style={{
          maxWidth: "95vw",
          maxHeight: "92vh",
          borderRadius: zoom > 1 ? 4 : 10,
          border: "1px solid #2a2f3a",
          transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
          transformOrigin: "center center",
          transition: dragRef.current.dragging ? "none" : "transform 0.15s ease",
          cursor: zoom > 1.05 ? "grab" : "zoom-out",
        }}
      />

      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "#374151", letterSpacing: 1, whiteSpace: "nowrap" }}>
        SCROLL OR PINCH TO ZOOM · DRAG TO PAN · DOUBLE-TAP TO TOGGLE ZOOM · TAP TO CLOSE
      </div>
    </div>
  );
}

const ctrlBtn = {
  width: 36, height: 36, borderRadius: 8, border: "1px solid #2a2f3a",
  background: "rgba(13,17,23,0.8)", color: "#e6edf3", fontSize: 20, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
};

const zoomLabel = {
  fontSize: 11, color: "#f5c842", fontWeight: 700, cursor: "pointer",
  background: "rgba(13,17,23,0.8)", padding: "4px 10px", borderRadius: 6,
  border: "1px solid #2a2f3a", fontFamily: "inherit",
};
