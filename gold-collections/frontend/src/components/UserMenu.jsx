import { useEffect, useRef, useState } from "react";
import { ChevronDown, KeyRound, Languages, LogOut, Moon, Sun } from "lucide-react";

export default function UserMenu({ user, initials, t, lang, setLang, theme, setTheme, onPassword, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, []);

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm text-ink hover:bg-hover";
  const run = (fn) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-2 rounded-xl py-1 pe-2 ps-1 text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-orange-300">
        <span className="grid size-8 place-items-center rounded-full bg-[#d5ff66] text-xs font-semibold text-[#172000]">{initials}</span>
        <span className="hidden text-start leading-tight md:block">
          <span className="block max-w-[110px] truncate text-sm font-medium">{user.name}</span>
          <span className="block text-[10px] text-white/55">{user.role === "admin" ? t("rAdmin") : t("rCollector")}</span>
        </span>
        <ChevronDown size={14} className="text-white/60" />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-56 rounded-lg border border-line bg-panel p-1.5 shadow-pop">
          <div className="border-b border-line px-3 pb-2 pt-1.5 md:hidden">
            <div className="truncate text-sm font-semibold text-ink">{user.name}</div>
            <div className="text-xs text-dim">{user.role === "admin" ? t("rAdmin") : t("rCollector")}</div>
          </div>
          <button role="menuitem" className={item} onClick={run(() => setLang(lang === "ar" ? "en" : "ar"))}><Languages size={16} className="text-dim" /> {t("language")}</button>
          <button role="menuitem" className={item} onClick={run(() => setTheme(theme === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? <Sun size={16} className="text-dim" /> : <Moon size={16} className="text-dim" />} {theme === "dark" ? t("lightMode") : t("darkMode")}
          </button>
          <button role="menuitem" className={item} onClick={run(onPassword)}><KeyRound size={16} className="text-dim" /> {t("changePassword")}</button>
          <div className="my-1 border-t border-line" />
          <button role="menuitem" className={item} onClick={run(onLogout)}><LogOut size={16} className="text-dim" /> {t("signOut")}</button>
        </div>
      )}
    </div>
  );
}
