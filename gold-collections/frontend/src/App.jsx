import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Coins, LayoutDashboard, UserCog, Users as UsersIcon,
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
import GlobalSearch from "./components/GlobalSearch.jsx";
import SyncBanner from "./components/SyncBanner.jsx";
import MacOSDock from "@/components/ui/mac-os-dock";
import DraggableDock from "./components/DraggableDock.jsx";
import UserMenu from "./components/UserMenu.jsx";

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

  const DOCK_GRAD = {
    overview: "from-orange-400 to-orange-600", customers: "from-sky-400 to-blue-600", myday: "from-emerald-400 to-emerald-600",
    kpi: "from-amber-300 to-yellow-600", users: "from-violet-400 to-purple-600",
  };
  const dockApps = routes.map((r) => ({ id: r.id, name: t(r.label), icon: r.icon, gradient: DOCK_GRAD[r.id] }));
  const initials = (user.name || "?").slice(0, 2).toUpperCase();

  return (
    <AppCtx.Provider value={ctx}>
      <div className="min-h-dvh bg-app">
        <SyncBanner />
        <header style={{ top: "var(--banner-height, 0px)" }} className="side-bg sticky z-40 border-b border-white/10 bg-side text-white">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5">
            {/* brand */}
            <a href="#/overview" className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white p-1.5">
                <img src="/swag-mark.png" alt="" className="h-full w-full object-contain" />
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-bold">{t("appName")}</span>
                <span className="hidden text-[10px] text-white/55 2xl:block">{t("appSub")}</span>
              </span>
            </a>

            <div className="ms-auto flex min-w-0 flex-1 items-center justify-end gap-3 lg:flex-none">
              {companies.length > 1 && (
                <div className="flex shrink-0 gap-1 rounded-xl bg-white/10 p-1" role="radiogroup" aria-label={t("company")}>
                  {companies.map((c) => (
                    <button key={c.key} role="radio" aria-checked={company === c.key} onClick={() => switchCompany(c.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                        company === c.key ? "bg-white text-[#1c1917] shadow" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="hidden w-56 xl:block 2xl:w-72"><GlobalSearch dark /></div>
              <UserMenu user={user} initials={initials} t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme}
                onPassword={() => setPwOpen(true)} onLogout={logout} />
            </div>
            <div className="order-last w-full xl:hidden"><GlobalSearch dark /></div>
          </div>
        </header>

        <DraggableDock resetLabel={t("dockReset")}>
          <MacOSDock apps={dockApps} openApps={[active]} onAppClick={go} />
        </DraggableDock>
        <main className="px-3 pb-32 pt-5 sm:px-6">
          <div className="mx-auto w-full max-w-[1400px]">
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
