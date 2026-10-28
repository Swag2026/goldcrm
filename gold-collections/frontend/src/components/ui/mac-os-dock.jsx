"use client";
// Ported from the macOS-style dock (TSX -> JSX). Icons are lucide glyphs on gradient tiles instead of image files.
import { useCallback, useEffect, useRef, useState } from "react";

const getResponsiveConfig = () => {
  if (typeof window === "undefined") return { baseIconSize: 64, maxScale: 1.6, effectWidth: 240 };
  const d = Math.min(window.innerWidth, window.innerHeight);
  if (d < 480) return { baseIconSize: Math.max(40, d * 0.08), maxScale: 1.4, effectWidth: d * 0.4 };
  if (d < 768) return { baseIconSize: Math.max(48, d * 0.07), maxScale: 1.5, effectWidth: d * 0.35 };
  if (d < 1024) return { baseIconSize: Math.max(52, d * 0.06), maxScale: 1.6, effectWidth: d * 0.3 };
  return { baseIconSize: Math.max(56, Math.min(68, d * 0.05)), maxScale: 1.7, effectWidth: 300 };
};

/** apps: [{ id, name, icon: LucideIcon, gradient: "from-.. to-.." }] */
export default function MacOSDock({ apps, onAppClick, openApps = [], className = "" }) {
  const [mouseX, setMouseX] = useState(null);
  const [hover, setHover] = useState(null);
  const [scales, setScales] = useState(() => apps.map(() => 1));
  const [positions, setPositions] = useState([]);
  const dockRef = useRef(null);
  const raf = useRef();
  const lastMove = useRef(0);
  const [config, setConfig] = useState(getResponsiveConfig);
  const { baseIconSize, maxScale, effectWidth } = config;
  const minScale = 1;
  const spacing = Math.max(4, baseIconSize * 0.08);
  const pad = Math.max(8, baseIconSize * 0.12);

  useEffect(() => {
    const on = () => setConfig(getResponsiveConfig());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const targetScales = useCallback((mx) => apps.map((_, i) => {
    if (mx === null) return minScale;
    const center = i * (baseIconSize + spacing) + baseIconSize / 2;
    const minX = mx - effectWidth / 2, maxX = mx + effectWidth / 2;
    if (center < minX || center > maxX) return minScale;
    const theta = Math.min(Math.max(((center - minX) / effectWidth) * 2 * Math.PI, 0), 2 * Math.PI);
    return minScale + ((1 - Math.cos(theta)) / 2) * (maxScale - minScale);
  }), [apps, baseIconSize, spacing, effectWidth, maxScale]);

  const calcPositions = useCallback((sc) => {
    let x = 0;
    return sc.map((s) => { const w = baseIconSize * s; const c = x + w / 2; x += w + spacing; return c; });
  }, [baseIconSize, spacing]);

  useEffect(() => {
    const s = apps.map(() => minScale);
    setScales(s);
    setPositions(calcPositions(s));
  }, [apps, calcPositions, config]);

  const animate = useCallback(() => {
    const ts = targetScales(mouseX);
    const tp = calcPositions(ts);
    const k = mouseX !== null ? 0.2 : 0.12;
    setScales((prev) => prev.map((c, i) => c + (ts[i] - c) * k));
    setPositions((prev) => prev.map((c, i) => c + (tp[i] - c) * k));
    const need = scales.some((s, i) => Math.abs(s - ts[i]) > 0.002) || positions.some((p, i) => Math.abs(p - tp[i]) > 0.1);
    if (need || mouseX !== null) raf.current = requestAnimationFrame(animate);
  }, [mouseX, targetScales, calcPositions, scales, positions]);

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(animate);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [animate]);

  const onMove = (e) => {
    const now = performance.now();
    if (now - lastMove.current < 16) return;
    lastMove.current = now;
    if (dockRef.current) setMouseX(e.clientX - dockRef.current.getBoundingClientRect().left - pad);
  };

  const bounce = (el) => {
    if (!el) return;
    el.style.transition = "transform 0.2s ease-out";
    el.style.transform = `translateY(${Math.max(-8, -baseIconSize * 0.15)}px)`;
    setTimeout(() => { el.style.transform = "translateY(0px)"; }, 200);
  };

  const contentWidth = positions.length
    ? Math.max(...positions.map((p, i) => p + (baseIconSize * scales[i]) / 2))
    : apps.length * (baseIconSize + spacing) - spacing;

  return (
    <div ref={dockRef} dir="ltr" onMouseMove={onMove} onMouseLeave={() => { setMouseX(null); setHover(null); }}
      className={`backdrop-blur-md ${className}`}
      style={{
        width: `${contentWidth + pad * 2}px`, background: "rgba(34, 30, 28, 0.78)",
        borderRadius: `${Math.max(14, baseIconSize * 0.4)}px`, border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: `0 ${Math.max(4, baseIconSize * 0.1)}px ${Math.max(16, baseIconSize * 0.4)}px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)`,
        padding: `${pad}px`,
      }}>
      <div className="relative" style={{ height: `${baseIconSize}px`, width: "100%" }}>
        {apps.map((app, i) => {
          const scale = scales[i] ?? 1;
          const size = baseIconSize * scale;
          const left = (positions[i] || 0) - size / 2;
          const Icon = app.icon;
          return (
            <button key={app.id} type="button" aria-label={app.name} aria-current={openApps.includes(app.id) ? "page" : undefined}
              onMouseEnter={() => setHover(app.id)}
              onClick={(e) => { bounce(e.currentTarget); onAppClick(app.id); }}
              className="absolute flex cursor-pointer flex-col items-center justify-end outline-none"
              style={{ left: `${left}px`, bottom: 0, width: `${size}px`, height: `${size}px`, transformOrigin: "bottom center", zIndex: Math.round(scale * 10) }}>
              {hover === app.id && (
                <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-white/15 bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-white shadow-lg">{app.name}</span>
              )}
              <span className={`grid h-full w-full place-items-center bg-gradient-to-b text-white ${app.gradient}`}
                style={{ borderRadius: "22%", boxShadow: `0 ${Math.max(2, baseIconSize * 0.05)}px ${Math.max(4, baseIconSize * 0.1)}px rgba(0,0,0,${0.25 + (scale - 1) * 0.15}), inset 0 1px 0 rgba(255,255,255,0.35)` }}>
                <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
              </span>
              {openApps.includes(app.id) && (
                <span className="absolute rounded-full bg-white/85" style={{ bottom: -Math.max(6, baseIconSize * 0.1), left: "50%", transform: "translateX(-50%)", width: Math.max(4, baseIconSize * 0.07), height: Math.max(4, baseIconSize * 0.07) }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
