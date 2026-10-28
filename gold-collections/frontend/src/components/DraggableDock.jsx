import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

const KEY = "gc_dock_pos";
const THRESHOLD = 6; // px of movement before a press becomes a drag (so clicks on icons still work)

const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null; } catch { return null; } };

// Wraps the dock so it can be dragged anywhere on screen. Drag by the grip or by the dock itself.
// Double-click the grip to put it back at the bottom centre. Position is remembered.
export default function DraggableDock({ children, resetLabel = "Double-click to reset" }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(load);
  const [dragging, setDragging] = useState(false);
  const st = useRef({ down: false, moved: false, sx: 0, sy: 0, ox: 0, oy: 0, id: null, swallow: false });

  const clamp = (x, y) => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 0, h = el?.offsetHeight ?? 0;
    return { x: Math.min(Math.max(4, x), Math.max(4, window.innerWidth - w - 4)), y: Math.min(Math.max(4, y), Math.max(4, window.innerHeight - h - 4)) };
  };

  // keep it on screen after resize / when the dock changes width
  useLayoutEffect(() => { if (pos) { const c = clamp(pos.x, pos.y); if (c.x !== pos.x || c.y !== pos.y) setPos(c); } }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // Window-level listeners while pressed, so fast drags that leave the dock keep working.
  // (No pointer capture: that would swallow the click on the icons.)
  const onMove = (e) => {
    const s = st.current;
    if (!s.down) return;
    const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
    if (!s.moved) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      s.moved = true; setDragging(true);
    }
    setPos(clamp(s.ox + dx, s.oy + dy));
  };
  const onUp = () => {
    const s = st.current;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (!s.down) return;
    s.down = false;
    if (s.moved) {
      s.swallow = true; // the click that follows a drag must not open a page
      setTimeout(() => { s.swallow = false; }, 0);
      setDragging(false);
      setPos((p) => { if (p) try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } return p; });
    }
  };
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const r = ref.current.getBoundingClientRect();
    Object.assign(st.current, { down: true, moved: false, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  const reset = () => { setPos(null); try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

  const style = pos
    ? { left: pos.x, top: pos.y }
    : { left: "50%", bottom: 12, transform: "translateX(-50%)" };

  return (
    <div ref={ref} style={style}
      onPointerDown={onPointerDown}
      onClickCapture={(e) => { if (st.current.swallow) { e.preventDefault(); e.stopPropagation(); } }}
      className={`fixed z-50 flex items-center gap-1 print:hidden ${dragging ? "cursor-grabbing select-none" : ""}`}>
      <button type="button" onDoubleClick={reset} title={resetLabel} aria-label="Move menu"
        className="grid h-12 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-xl border border-white/15 bg-[rgba(34,30,28,0.78)] text-white/60 backdrop-blur-md hover:text-white active:cursor-grabbing">
        <GripVertical size={16} />
      </button>
      {children}
    </div>
  );
}
