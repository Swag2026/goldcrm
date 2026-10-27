import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Coins, KeyRound, LayoutDashboard, Languages, LogOut, Moon, PanelLeft, Sun, UserCog, Users as UsersIcon, X,
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
import {
  AnimatedSidebar, AnimatedSidebarClose, AnimatedSidebarContent, AnimatedSidebarFooter, AnimatedSidebarGroup,
  AnimatedSidebarGroupContent, AnimatedSidebarGroupLabel, AnimatedSidebarHeader, AnimatedSidebarInset,
  AnimatedSidebarMenu, AnimatedSidebarMenuButton, AnimatedSidebarMenuItem, AnimatedSidebarProvider,
  AnimatedSidebarRail, AnimatedSidebarTrigger,
} from "@/components/ui/animated-sidebar";

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
  const [sbOpen, setSbOpen] = useState(() => localStorage.getItem("gc_sb") !== "0");
  const [pwOpen, setPwOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => { try { localStorage.setItem("gc_sb", sbOpen ? "1" : "0"); } catch { /* ignore */ } }, [sbOpen]);

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

  const curCompany = companies.find((c) => c.key === company);
  const side = lang === "ar" ? "right" : "left";
  const activeRoute = routes.find((r) => r.id === active);

  const sidebar = (
    <AnimatedSidebar ariaLabel={t("appName")} side={side} collapsible="icon" panelClassName="side-bg">
      <AnimatedSidebarHeader className="p-3 pb-2">
        <div className="flex min-h-11 items-center gap-3 overflow-hidden px-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
            <img src="/swag-mark.png" alt="" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
            <div className="truncate text-[15px] font-bold text-white">{t("appName")}</div>
            <div className="truncate text-[11px] text-white/55">{t("appSub")}</div>
          </div>
          <AnimatedSidebarClose className="ms-auto text-white/70 hover:bg-white/10 md:hidden">
            <X aria-hidden="true" className="size-4" />
          </AnimatedSidebarClose>
        </div>
      </AnimatedSidebarHeader>

      <AnimatedSidebarContent className="pt-1">
        {companies.length > 1 && (
          <AnimatedSidebarGroup className="pb-1">
            <AnimatedSidebarGroupLabel className="mb-0 h-6">{t("company")}</AnimatedSidebarGroupLabel>
            <div className="flex gap-1 rounded-xl bg-white/10 p-1 group-data-[state=collapsed]/sidebar:flex-col" role="radiogroup">
              {companies.map((c) => (
                <button key={c.key} role="radio" aria-checked={company === c.key} title={c.name}
                  onClick={() => switchCompany(c.key)}
                  className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    company === c.key ? "bg-white text-[#1c1917] shadow" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                  <span className="group-data-[state=collapsed]/sidebar:hidden">{c.name}</span>
                  <span className="hidden group-data-[state=collapsed]/sidebar:inline">{c.name.slice(0, 2)}</span>
                </button>
              ))}
            </div>
          </AnimatedSidebarGroup>
        )}

        <AnimatedSidebarGroup className="pt-1">
          <AnimatedSidebarGroupLabel>{t("grpMain")}</AnimatedSidebarGroupLabel>
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              {routes.map((r) => (
                <AnimatedSidebarMenuItem key={r.id}>
                  <AnimatedSidebarMenuButton isActive={active === r.id} icon={<r.icon className="size-4" />} onSelect={() => go(r.id)}>
                    {t(r.label)}
                  </AnimatedSidebarMenuButton>
                </AnimatedSidebarMenuItem>
              ))}
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>

        <AnimatedSidebarGroup className="pt-1">
          <AnimatedSidebarGroupLabel>{t("grpAccount")}</AnimatedSidebarGroupLabel>
          <AnimatedSidebarGroupContent>
            <AnimatedSidebarMenu>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton icon={<Languages className="size-4" />} closeOnSelect={false} onSelect={() => setLang(lang === "ar" ? "en" : "ar")}>
                  {t("language")}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton icon={theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />} closeOnSelect={false}
                  onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {theme === "dark" ? t("lightMode") : t("darkMode")}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton icon={<KeyRound className="size-4" />} onSelect={() => setPwOpen(true)}>
                  {t("changePassword")}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
              <AnimatedSidebarMenuItem>
                <AnimatedSidebarMenuButton icon={<LogOut className="size-4" />} onSelect={logout}>
                  {t("signOut")}
                </AnimatedSidebarMenuButton>
              </AnimatedSidebarMenuItem>
            </AnimatedSidebarMenu>
          </AnimatedSidebarGroupContent>
        </AnimatedSidebarGroup>
      </AnimatedSidebarContent>

      <AnimatedSidebarFooter className="gap-3 border-none p-3">
        <div className="flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl p-1 text-start">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d5ff66] text-xs font-semibold text-[#172000]">
            {(user.name || "?").slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-white/55">{user.role === "admin" ? t("rAdmin") : t("rCollector")}</span>
          </span>
        </div>
      </AnimatedSidebarFooter>

      <AnimatedSidebarRail />
    </AnimatedSidebar>
  );

  return (
    <AppCtx.Provider value={ctx}>
      <AnimatedSidebarProvider open={sbOpen} onOpenChange={setSbOpen} className="bg-app" style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4.5rem" }}>
        {sidebar}
        <AnimatedSidebarInset className="min-h-svh bg-app">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel px-3 py-2 sm:px-5">
            <AnimatedSidebarTrigger className="text-dim transition-colors hover:bg-hover hover:text-ink">
              <PanelLeft aria-hidden="true" className="size-[18px] rtl:scale-x-[-1]" />
            </AnimatedSidebarTrigger>
            <div className="h-5 w-px bg-line" />
            <span className="text-sm font-semibold text-ink">{activeRoute ? t(activeRoute.label) : t("appName")}</span>
            {companies.length > 1 && curCompany && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">{curCompany.name}</span>
            )}
            <span className="ms-auto hidden text-[11px] text-faint lg:block">Ctrl/⌘ + B</span>
          </header>
          <div className="p-4 sm:p-6">
            <div className="mx-auto w-full max-w-[1280px]">
              <Page key={`${active}-${company}`} />
            </div>
          </div>
        </AnimatedSidebarInset>

        {drawerId && <CustomerDrawer id={drawerId} onClose={() => setDrawerId(null)} />}
        {stmtId && <StatementModal id={stmtId} onClose={() => setStmtId(null)} />}
        {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} toast={toast} />}
        {toastMsg && (
          <div className={`fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-pop ${
            toastMsg.tone === "ok" ? "bg-ok text-white" : "bg-danger text-white"}`}>
            {toastMsg.msg}
          </div>
        )}
      </AnimatedSidebarProvider>
    </AppCtx.Provider>
  );
}
