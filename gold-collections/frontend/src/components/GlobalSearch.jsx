import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Avatar, CustName, fmt, useApp } from "../ui.jsx";

// Header search: type a name or code anywhere, Enter/click opens the customer. Ctrl/Cmd+K focuses it.
export default function GlobalSearch({ dark = false }) {
  const { t, isAr } = useI18n();
  const { openCustomer, company } = useApp();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setRows([]); return; }
    setBusy(true);
    const id = setTimeout(() => {
      api.customers({ q: term, flt: "all", sort: "gold", desc: true })
        .then((d) => { setRows((d.items || []).slice(0, 8)); setIdx(0); })
        .catch(() => setRows([]))
        .finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(id);
  }, [q, company]);

  const pick = (c) => { setOpen(false); setQ(""); setRows([]); inputRef.current?.blur(); openCustomer(c.id); };
  const onKeyDown = (e) => {
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && rows[idx]) { e.preventDefault(); pick(rows[idx]); }
  };

  const show = open && q.trim().length >= 2;
  return (
    <div ref={boxRef} className="relative w-full">
      <Search size={15} className={`pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 ${dark ? "text-white/55" : "text-faint"}`} />
      <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
        placeholder={t("searchAnywhere")} aria-label={t("searchAnywhere")}
        className={`w-full rounded-lg border py-2 pe-12 ps-9 text-sm focus:outline-none focus:ring-2 ${dark ? "border-white/15 bg-white/10 text-white placeholder:text-white/50 focus:border-orange-400 focus:ring-orange-400/30" : "border-line bg-card text-ink placeholder:text-faint focus:border-orange-500 focus:ring-orange-500/20"}`} />
      <kbd className={`pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[10px] 2xl:block ${dark ? "border-white/20 text-white/55" : "border-line bg-panel text-faint"}`}>Ctrl K</kbd>
      {show && (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-line bg-panel shadow-pop">
          {rows.length === 0 ? (
            <div className="px-4 py-3 text-sm text-faint">{busy ? t("loading") : t("noCustomers")}</div>
          ) : rows.map((c, i) => (
            <button key={c.id} onMouseEnter={() => setIdx(i)} onClick={() => pick(c)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-start ${i === idx ? "bg-hover" : ""}`}>
              <Avatar c={c} isAr={isAr} size={30} />
              <span className="min-w-0 flex-1">
                <CustName c={c} isAr={isAr} compact className="text-sm font-medium" />
                <span className="block text-[11px] text-faint" dir="ltr">{c.code}</span>
              </span>
              <span className="shrink-0 text-end text-[11px] tabular-nums" dir="ltr">
                <span className={c.gold_balance > 0.0005 ? "font-semibold text-danger" : "text-faint"}>{fmt(c.gold_balance)} g</span><br />
                <span className={c.cash_balance > 0.5 ? "font-semibold text-danger" : "text-faint"}>{fmt(c.cash_balance, 0)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
