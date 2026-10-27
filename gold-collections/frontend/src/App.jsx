import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Coins, KeyRound, LayoutDashboard, Languages, LogOut, Menu, Moon, Sun, UserCog, Users as UsersIcon, X,
} from "lucide-react";
import { api, getCompany, getToken, setCompany as setApiCompany, setToken, setUnauthorizedHandler } from "./api.js";
import { useI18n } from "./i18n.jsx";
import { AppCtx, Btn, ErrorBox, Field, Modal, Spinner, inputCls } from "./ui.jsx";
import Login from "./components/Login.jsx";
import Overview from "./components/Overview.jsx";
import Customers from "./components/Customers.jsx";
import CustomerDrawer from "./components/CustomerDrawer.jsx";
import StatementModal from "./components/StatementModal.jsx";
import MyDay from "./components/MyDay.jsx";
import GoldKpi from "./components/GoldKpi.jsx";
import UsersPage from "./components/UsersPage.jsx";

const ROUTES = [
  { id: "overview", icon: LayoutDashboard, label: "navOverview" },
  { id: "customers", icon: UsersIcon, label: "navCustomers" },
  { id: "myday", icon: CalendarCheck, label: "navMyDay" },
  { id: "kpi", icon: Coins, label: "navKpi" },
  { id: "users", icon: UserCog, label: "navUsers", admin: true },
];

const readRoute = () => (window.location.hash.replace(/^#\/?/, "") || "overview").split("?")[0];

function PasswordModal({ onClose, toast }) {
  const { t } = useI18n();
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.changePassword(cur, nw);
      toast(t("saved"));
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={t("changePassword")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field label={t("currentPassword")}>
          <input type="password" className={inputCls} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label={t("newPassword")}>
          <input type="password" className={inputCls} value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" />
        </Field>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <Btn type="button" onClick={onClose}>{t("cancel")}</Btn>
          <Btn variant="primary" type="submit" loading={busy} disabled={!cur || nw.length < 8}>{t("save")}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function App() {
  const { t, lang, setLang } = useI18n();
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(!!getToken());
  const [route, setRoute] = useState(readRoute());
  const [drawerId, setDrawerId] = useState(null);
  const [stmtId, setStmtId] = useState(null);
  const [version, setVersion] = useState(0);
  const [collectors, setCollectors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [company, setCompanyState] = useState(getCompany());
  const [theme, setTheme] = useState(() => localStorage.getItem("gc_theme") || "light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gc_theme", theme);
  }, [theme]);

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setDrawerId(null);
  }, []);
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  useEffect(() => {
    if (!getToken()) return;
    api.me().then(setUser).catch(() => logout()).finally(() => setBooting(false));
  }, [logout]);

  useEffect(() => {
    if (!user) return;
    api.collectors().then(setCollectors).catch(() => {});
    api.companies().then((list) => {
      setCompanies(list);
      const cur = list.find((c) => c.key === getCompany()) || list[0];
      if (cur) { setApiCompany(cur.key); setCompanyState(cur.key); }
    }).catch(() => {});
  }, [user]);

  const switchCompany = (key) => {
    if (key === company) return;
    setApiCompany(key);
    setCompanyState(key);
    setDrawerId(null);
    setStmtId(null);
  };

  const toast = useCallback((msg, tone = "ok") => {
    setToastMsg({ msg, tone });
    setTimeout(() => setToastMsg(null), 2600);
  }, []);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const go = (id) => {
    window.location.hash = `#/${id}`;
    setMenuOpen(false);
  };

  const ctx = useMemo(
    () => ({ user, collectors, company, companies, openCustomer: setDrawerId, openStatement: setStmtId, bump, version, toast }),
    [user, collectors, company, companies, bump, version, toast]
  );

  if (booting) return <Spinner label={t("loading")} />;
  if (!user) return <Login onLogin={setUser} />;

  const routes = ROUTES.filter((r) => !r.admin || user.role === "admin");
  const active = routes.find((r) => r.id === route) ? route : "overview";

  const Page = { overview: Overview, customers: Customers, myday: MyDay, kpi: GoldKpi, users: UsersPage }[active];

  const sidebar = (
    <aside className="side-bg flex h-full w-64 flex-col bg-side text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
          <img src="/swag-mark.png" alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-bold">{t("appName")}</div>
          <div className="truncate text-[11px] text-white/55">{t("appSub")}</div>
        </div>
      </div>
      {companies.length > 1 && (
        <div className="px-4 pb-1">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">{t("company")}</div>
          <div className="flex gap-1 rounded-xl bg-white/10 p-1" role="radiogroup">
            {companies.map((c) => (
              <button key={c.key} role="radio" aria-checked={company === c.key} onClick={() => { switchCompany(c.key); setMenuOpen(false); }}
                className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-xs font-bold ${
                  company === c.key ? "bg-white text-[#211c3d] shadow" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {routes.map((r) => (
          <button
            key={r.id}
            onClick={() => go(r.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm font-medium ${
              active === r.id ? "bg-white/15 text-white" : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
          >
            <r.icon size={18} /> {t(r.label)}
          </button>
        ))}
      </nav>
      <div className="space-y-2 border-t border-white/10 p-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold">
            {(user.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 text-xs">
            <div className="truncate font-semibold">{user.name}</div>
            <div className="text-white/55">{user.role === "admin" ? t("rAdmin") : t("rCollector")}</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} title={t("language")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2 text-xs hover:bg-white/20">
            <Languages size={14} /> {t("language")}
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={t("theme")}
            className="flex w-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={() => setPwOpen(true)} title={t("changePassword")}
            className="flex w-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
            <KeyRound size={14} />
          </button>
          <button onClick={logout} title={t("signOut")}
            className="flex w-10 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-dvh bg-app">
        {/* desktop sidebar */}
        <div className="fixed inset-y-0 start-0 z-30 hidden w-64 lg:block">{sidebar}</div>
        {/* mobile bar + drawer */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel px-4 py-3 lg:hidden">
          <button onClick={() => setMenuOpen(true)} aria-label="menu"><Menu size={22} /></button>
          <span className="font-bold">{t("appName")}</span>
          {companies.length > 1 && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{companies.find((c) => c.key === company)?.name}</span>}
        </header>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute inset-y-0 start-0" onClick={(e) => e.stopPropagation()}>
              <button className="absolute end-2 top-2 z-10 text-white/70" onClick={() => setMenuOpen(false)}><X size={20} /></button>
              {sidebar}
            </div>
          </div>
        )}

        <main className="p-4 sm:p-6 lg:ms-64">
          <div className="mx-auto max-w-[1280px]">
            <Page key={`${active}-${company}`} />
          </div>
        </main>

        {drawerId && <CustomerDrawer id={drawerId} onClose={() => setDrawerId(null)} />}
        {stmtId && <StatementModal id={stmtId} onClose={() => setStmtId(null)} />}
        {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} toast={toast} />}
        {toastMsg && (
          <div className={`fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-pop ${
            toastMsg.tone === "ok" ? "bg-ok text-white" : "bg-danger text-white"}`}>
            {toastMsg.msg}
          </div>
        )}
      </div>
    </AppCtx.Provider>
  );
}
