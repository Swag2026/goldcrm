import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, MessageCircle, Phone } from "lucide-react";
import { Spinner as LoadingSpinner } from "@/components/ui/spinner";
import { useI18n } from "./i18n.jsx";

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// ---------------------------------------------------------------- formatting
export const fmt = (n, d = 2) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtG = (n) => fmt(n, 2);
export const fmtDate = (s) => (s ? String(s).slice(0, 10) : "");
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDays = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
// GERP naam Arabic hote hain, bracket mein trade name / English: "شركة ... ( معرض سواج جولد )".
// Spaces theek karo, bracket wala hissa alag (chhoti muted line), aur bidi mix na ho.
export const normName = (s) => String(s || "").replace(/\s+/g, " ").replace(/([(（])\s+/g, "$1").replace(/\s+([)）])/g, "$1").trim();
export function splitName(raw) {
  const n = normName(raw);
  const m = n.match(/^(.*?)\s*[(（]([^()（）]+)[)）]\s*$/);
  return m && m[1] ? { main: m[1].trim(), sub: m[2].trim() } : { main: n, sub: "" };
}
export const custName = (c, isAr) => normName(isAr ? c.name_ar || c.name : c.name || c.name_ar) || c.code || "";

// stack: main naam (wrap hota hai, truncate nahi) + neeche bracket wala hissa. compact: ek line, truncate.
export function CustName({ c, isAr, compact = false, clamp = false, className = "" }) {
  const full = custName(c, isAr);
  const { main, sub } = splitName(full);
  if (compact || clamp) {
    return (
      <span className={`block ${clamp ? "line-clamp-2 break-words leading-snug" : "truncate"} ${className}`} title={full}>
        <span className="[unicode-bidi:isolate]">{main}</span>
        {sub && <span className="ms-1.5 text-[0.85em] font-normal text-dim [unicode-bidi:isolate]">({sub})</span>}
      </span>
    );
  }
  return (
    <span className={`block ${className}`} title={full}>
      <span className="block break-words leading-snug text-left rtl:text-right [unicode-bidi:plaintext]">{main}</span>
      {sub && <span className="mt-0.5 block break-words text-left text-[11px] font-normal leading-tight text-dim rtl:text-right [unicode-bidi:plaintext]">{sub}</span>}
    </span>
  );
}

// Positive balance = customer owes us (red). Negative = we owe the customer (brand).
export const balTone = (n, eps = 0.0005) => (n > eps ? "text-danger" : n < -eps ? "text-brand" : "text-faint");

// ---------------------------------------------------------------- primitives
export const inputCls =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-faint " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function Card({ className = "", children, ...rest }) {
  return (
    <div className={`rounded-lg border border-line bg-panel shadow-sm ${className}`} {...rest}>
      {children}
    </div>
  );
}

const BTN = {
  primary: "bg-gradient-to-t from-orange-500 to-orange-600 text-white border-orange-400 shadow-md shadow-orange-500/30 hover:opacity-90",
  ghost: "bg-panel text-ink border-line hover:bg-hover",
  danger: "bg-danger-soft text-danger border-transparent hover:opacity-80",
  ok: "bg-ok-soft text-ok border-transparent hover:opacity-80",
};
export function Btn({ variant = "ghost", size = "md", className = "", loading, children, ...rest }) {
  const sz = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium disabled:opacity-50 disabled:cursor-not-allowed ${sz} ${BTN[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <LoadingSpinner variant="circle" size={14} />}
      {children}
    </button>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium text-dim ${className}`}>
      {label}
      {children}
    </label>
  );
}

const TONES = {
  neutral: "bg-card text-dim",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  brand: "bg-brand/10 text-brand",
  gold: "bg-gold-soft text-gold",
};
export function Badge({ tone = "neutral", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-sm text-dim" role="status">
      <LoadingSpinner variant="ring" size={44} className="text-orange-500" />
      <span>{label}</span>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="p-8 text-center text-sm text-faint">{children}</div>;
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return <div className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger">⚠️ {children}</div>;
}

// ---------------------------------------------------------------- domain widgets
export function Bal({ value, unit = "", digits = 2, className = "" }) {
  return (
    <span className={`tabular-nums font-semibold ${balTone(value)} ${className}`} dir="ltr">
      {value > 0.0005 ? "+" : ""}
      {fmt(value, digits)}
      {unit && <span className="ms-1 text-[11px] font-normal text-faint">{unit}</span>}
    </span>
  );
}

export function StatusBadge({ status }) {
  const { t } = useI18n();
  const map = { active: ["ok", "stActive"], hold: ["warn", "stHold"], legal: ["danger", "stLegal"] };
  const [tone, key] = map[status] || map.active;
  return <Badge tone={tone}>{t(key)}</Badge>;
}

export function PromiseBadge({ promise }) {
  const { t } = useI18n();
  if (!promise) return <span className="text-faint">—</span>;
  return (
    <Badge tone={promise.overdue ? "danger" : "gold"}>
      {fmtDate(promise.date)}
      {promise.overdue ? " ⚠" : ""}
    </Badge>
  );
}

export function Modal({ title, onClose, children, width = "max-w-md" }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div className={`w-full ${width} rounded-2xl border border-line bg-panel p-5 shadow-pop`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-dim hover:text-ink" aria-label={t("close")}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------- motion + mini charts (dashboard v2)
export function useCountUp(target, duration = 900) {
  const end = typeof target === "number" && !Number.isNaN(target) ? target : 0;
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || duration <= 0) { setV(end); from.current = end; return undefined; }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      setV(start + (end - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration]);
  return v;
}

export function CountUp({ value, digits = 0 }) {
  const v = useCountUp(value);
  return <span dir="ltr">{fmt(v, digits)}</span>;
}

function smoothPath(pts) {
  return pts.map(([x, y], i) => {
    if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = pts[i - 1];
    const m = (px + x) / 2;
    return `C ${m.toFixed(1)} ${py.toFixed(1)}, ${m.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function Sparkline({ data, color = "var(--primary)", height = 44, className = "" }) {
  const id = useId().replace(/:/g, "");
  if (!data || data.length < 2) return <div style={{ height }} className={className} />;
  const W = 200;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * W, height - 4 - ((d - min) / span) * (height - 10)]);
  const line = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={`w-full ${className}`} style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${W} ${height} L 0 ${height} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

// Receivable (jo humein milna hai) ka ghatna = achha (green), badhna = bura (red)
export function DeltaChip({ value, unit = "", digits = 0, since, className = "" }) {
  if (value === null || value === undefined) return null;
  if (Math.abs(value) < Math.pow(10, -digits) / 2) {
    return <span className={`text-[11px] text-faint ${className}`}>= {since}</span>;
  }
  const down = value < 0;
  const Icon = down ? ArrowDownRight : ArrowUpRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
      down ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"} ${className}`} dir="ltr">
      <Icon size={12} />
      {fmt(Math.abs(value), digits)}{unit && ` ${unit}`}
      {since && <span className="ms-1 font-normal opacity-70">{since}</span>}
    </span>
  );
}

// Table ke andar chhota delta (balance ke neeche)
export function DeltaMini({ value, balance, digits = 2 }) {
  if (value === null || value === undefined || Math.abs(value) < Math.pow(10, -digits) / 2) return null;
  const tone = balance > 0 ? (value < 0 ? "text-ok" : "text-danger") : "text-faint";
  return (
    <div className={`text-[10px] font-medium ${tone}`} dir="ltr">
      {value < 0 ? "▼" : "▲"} {fmt(Math.abs(value), digits)}
    </div>
  );
}

export function Pills({ value, options, onChange, className = "" }) {
  return (
    <div className={`inline-flex rounded-lg border border-line bg-card p-0.5 text-xs font-semibold ${className}`} role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`rounded-md px-2.5 py-1 ${value === v ? "bg-gradient-to-t from-orange-500 to-orange-600 text-white shadow-sm shadow-orange-500/40" : "text-dim hover:text-ink"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Tile({ title, action, className = "", children, pad = true }) {
  return (
    <section className={`rounded-lg border border-line bg-panel shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 px-5 pt-4">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {action}
        </header>
      )}
      <div className={pad ? "p-5 pt-3" : ""}>{children}</div>
    </section>
  );
}


// Saudi mobile => wa.me format (05XXXXXXXX -> 9665XXXXXXXX)
export function waNumber(m) {
  let d = String(m || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05") && d.length === 10) d = "966" + d.slice(1);
  else if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d;
}

export function ContactLinks({ mobile, className = "" }) {
  if (!mobile) return null;
  const base = "inline-flex h-7 w-7 items-center justify-center rounded-md text-dim hover:bg-card";
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} onClick={(e) => e.stopPropagation()}>
      <a href={`tel:${mobile}`} title={mobile} className={`${base} hover:text-brand`}><Phone size={15} /></a>
      <a href={`https://wa.me/${waNumber(mobile)}`} target="_blank" rel="noreferrer" title="WhatsApp" className={`${base} hover:text-ok`}><MessageCircle size={15} /></a>
    </span>
  );
}

export function TxnAge({ date, days, t }) {
  if (!date) return <span className="text-faint">—</span>;
  const tone = days > 30 ? "bg-danger-soft text-danger" : days > 7 ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok";
  return (
    <span className="inline-flex flex-col items-start gap-0.5" dir="ltr" title={date}>
      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
        {days === 0 ? t("today") : <>{days} <span className="[unicode-bidi:isolate]">{t("daysAgo")}</span></>}
      </span>
      <span className="ps-1 text-[10px] text-faint">{date}</span>
    </span>
  );
}

// Avatar circle with 2-letter initials, colour picked from a stable hash.
const AV_TONES = [
  "bg-orange-100 text-orange-800", "bg-sky-100 text-sky-800", "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800", "bg-amber-100 text-amber-800",
];
export function Avatar({ c, isAr, size = 34 }) {
  const name = splitName(custName(c, isAr)).main || "?";
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
  const ini = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
  const tone = AV_TONES[Math.abs(Number(c.id) || 0) % AV_TONES.length];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      {ini}
    </span>
  );
}
