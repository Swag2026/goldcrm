import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, FileText, MessageCircle, Phone, RefreshCw, Search, Upload } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import ImportReportModal from "./ImportReportModal.jsx";
import {
  Bal, Badge, Btn, Card, ContactLinks, DeltaMini, Empty, ErrorBox, PromiseBadge, Spinner, StatusBadge, TxnAge, CustName, Avatar, waNumber, fmtDate, inputCls, todayISO, useApp,
} from "../ui.jsx";

const FILTERS = [
  ["with_balance", "fltWithBalance"], ["all", "fltAll"], ["gold_debtors", "fltGold"],
  ["cash_debtors", "fltCash"], ["silver_debtors", "fltSilver"], ["we_owe", "fltWeOwe"],
];

const readHashParams = () => {
  const q = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(q);
};

export default function Customers() {
  const { t, isAr } = useI18n();
  const { user, collectors, openCustomer, openStatement, version, bump, toast } = useApp();
  const init = readHashParams();
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState(init.get("flt") || "with_balance");
  const [assigned, setAssigned] = useState(init.get("assigned") || "");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("gold");
  const [desc, setDesc] = useState(true);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(new Set());
  const [bulkUser, setBulkUser] = useState("");
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const doSync = async () => {
    setSyncing(true);
    try { await api.sync(); bump(); } catch (e) { toast(e.message, "err"); } finally { setSyncing(false); }
  };
  const isAdmin = user.role === "admin";

  useEffect(() => {
    const on = () => {
      const p = readHashParams();
      if (p.has("flt")) setFlt(p.get("flt"));
      setAssigned(p.get("assigned") || "");
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const [dq, setDq] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(() => {
    setErr("");
    return api.customers({ q: dq, flt, assigned, status, sort, desc }).then(setData).catch((e) => setErr(e.message));
  }, [dq, flt, assigned, status, sort, desc]);
  useEffect(() => { load(); }, [load, version]);

  const items = data?.items || [];
  const allSelected = items.length > 0 && items.every((c) => sel.has(c.id));
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(items.map((c) => c.id)));
  const toggleOne = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const setSortBy = (key) => {
    if (sort === key) setDesc(!desc);
    else { setSort(key); setDesc(key !== "name"); }
  };

  const doExport = async () => {
    setExporting(true);
    try { await api.exportXlsx({ q: dq, flt, assigned, status }); }
    catch (e) { toast(e.message, "err"); }
    finally { setExporting(false); }
  };

  const doBulk = async () => {
    try {
      await api.assign([...sel], bulkUser === "" ? null : Number(bulkUser));
      toast(t("assignedOk"));
      setSel(new Set());
      bump();
    } catch (e) { toast(e.message, "err"); }
  };

  const today = useMemo(todayISO, []);
  const maxGold = useMemo(() => Math.max(...((data?.items) || []).map((c) => Math.abs(c.gold_balance)), 1), [data]);
  const Th = ({ k, children, className = "" }) => (
    <th className={`whitespace-nowrap px-3 py-2.5 text-start text-[11px] font-semibold uppercase tracking-wide text-dim ${className}`}>
      {k ? (
        <button onClick={() => setSortBy(k)} className="inline-flex items-center gap-1 uppercase hover:text-ink">
          {children}{sort === k && (desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
        </button>
      ) : children}
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("customers")} <span className="text-sm font-normal text-dim">· {data?.total ?? "…"} {t("results")}</span></h1>
        <div className="flex gap-2">
          {isAdmin && <Btn onClick={() => setImporting(true)}><Upload size={14} /> {t("importReport")}</Btn>}
          <Btn onClick={doExport} loading={exporting}><Download size={14} /> {t("exportExcel")}</Btn>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className={`${inputCls} ps-9`} placeholder={t("searchCustomers")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={`${inputCls} !w-auto`} value={flt} onChange={(e) => setFlt(e.target.value)}>
            {FILTERS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
          </select>
          <select className={`${inputCls} !w-auto`} value={assigned} onChange={(e) => setAssigned(e.target.value)}>
            <option value="">{t("assignedTo")}: {t("all")}</option>
            <option value="me">{t("mine")}</option>
            <option value="unassigned">{t("unassigned")}</option>
            {collectors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className={`${inputCls} !w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("status")}: {t("all")}</option>
            <option value="active">{t("stActive")}</option>
            <option value="hold">{t("stHold")}</option>
            <option value="legal">{t("stLegal")}</option>
          </select>
        </div>
        {isAdmin && sel.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-brand/10 p-2.5 text-sm">
            <b>{sel.size}</b> {t("selected")}
            <select className={`${inputCls} !w-auto`} value={bulkUser} onChange={(e) => setBulkUser(e.target.value)}>
              <option value="">{t("unassigned")}</option>
              {collectors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <Btn variant="primary" size="sm" onClick={doBulk}>{t("assignSelected")}</Btn>
          </div>
        )}
      </Card>

      <ErrorBox>{err}</ErrorBox>
      {data?.sync?.last_error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/30 bg-warn-soft p-3 text-sm text-warn">
          <span>⚠️ {t("syncFailedBanner")} <span className="text-xs opacity-80" dir="ltr">{data.sync.last_error.slice(0, 160)}</span></span>
          <Btn size="sm" onClick={doSync} loading={syncing}><RefreshCw size={13} /> {t("syncNow")}</Btn>
        </div>
      )}
      <Card className="overflow-hidden">
        {!data ? <Spinner label={t("loading")} /> : items.length === 0 ? <Empty>{data.sync?.last_sync ? t("noCustomers") : t("noSyncYet")}</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b-2 border-line bg-card">
                <tr>
                  {isAdmin && <th className="w-10 px-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>}
                  <Th k="name">{t("customer")}</Th>
                  <Th k="gold" className="text-end">{t("gold")}</Th>
                  <Th k="cash">{t("cash")} ({t("sar")})</Th>
                  <Th k="silver">{t("silver")}</Th>
                  <Th className="hidden 2xl:table-cell">{t("assignedTo")}</Th>
                  <Th>{t("status")}</Th>
                  <Th className="hidden xl:table-cell">{t("lastTxn")}</Th>
                  <Th k="last_followup" className="hidden xl:table-cell">{t("lastFollowup")}</Th>
                  <Th className="hidden 2xl:table-cell">{t("nextFollowup")}</Th>
                  <Th>{t("promise")}</Th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const due = c.next_followup_date && c.next_followup_date <= today;
                  return (
                    <tr key={c.id} onClick={() => openCustomer(c.id)} className="group cursor-pointer border-b border-line last:border-0 hover:bg-hover">
                      {isAdmin && (
                        <td className="px-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleOne(c.id)} />
                        </td>
                      )}
                      <td className="min-w-[220px] max-w-[320px] px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar c={c} isAr={isAr} />
                          <div className="min-w-0 flex-1">
                            <CustName c={c} isAr={isAr} className="font-medium" />
                            <div className="mt-0.5 text-[11px] text-faint" dir="ltr">{c.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <Bal value={c.gold_balance} unit={t("grams")} /><DeltaMini value={c.delta?.gold} balance={c.gold_balance} />
                        <div className="ms-auto mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-line" dir="ltr">
                          <div className={`h-full rounded-full ${c.gold_balance < 0 ? "bg-brand/60" : "bg-orange-500"}`} style={{ width: `${Math.min(100, (Math.abs(c.gold_balance) / maxGold) * 100)}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><Bal value={c.cash_balance} digits={0} /><DeltaMini value={c.delta?.cash} balance={c.cash_balance} digits={0} /></td>
                      <td className="px-3 py-2.5"><Bal value={c.silver_balance} unit={t("grams")} digits={0} /><DeltaMini value={c.delta?.silver} balance={c.silver_balance} digits={0} /></td>
                      <td className="hidden px-3 py-2.5 2xl:table-cell">
                        {c.assigned_name ? c.assigned_name : <Badge tone="neutral">{t("unassigned")}</Badge>}
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                      <td className="hidden px-3 py-2.5 xl:table-cell"><TxnAge date={c.last_txn_date} days={c.days_since_txn} t={t} /></td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-dim xl:table-cell" dir="ltr">{fmtDate(c.last_followup_at) || (Math.abs(c.gold_balance) > 0.0005 || Math.abs(c.cash_balance) > 0.5 ? <span className="rounded-full border border-line bg-card px-2.5 py-0.5 text-xs font-medium text-dim" dir="auto">{t("neverContacted")}</span> : "—")}</td>
                      <td className={`hidden whitespace-nowrap px-3 py-2.5 2xl:table-cell ${due ? "font-semibold text-warn" : "text-dim"}`} dir="ltr">{fmtDate(c.next_followup_date) || "—"}</td>
                      <td className="px-3 py-2.5"><PromiseBadge promise={c.promise} /></td>
                      <td className="whitespace-nowrap px-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
                          {c.mobile && (
                            <>
                              <a href={`https://wa.me/${waNumber(c.mobile)}`} target="_blank" rel="noreferrer" title="WhatsApp" className="grid size-8 place-items-center rounded-lg border border-line bg-panel text-dim hover:text-ok"><MessageCircle size={15} /></a>
                              <a href={`tel:${c.mobile}`} title={c.mobile} className="grid size-8 place-items-center rounded-lg border border-line bg-panel text-dim hover:text-brand"><Phone size={15} /></a>
                            </>
                          )}
                          <button onClick={() => openStatement(c.id)} title={t("statementBtn")} className="grid size-8 place-items-center rounded-lg border border-line bg-panel text-dim hover:text-brand"><FileText size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {importing && <ImportReportModal onClose={() => setImporting(false)} />}
      <p className="text-xs text-faint">
        <span className="text-danger">+</span> {t("owesUs")} · <span className="text-brand">−</span> {t("weOwe")}
        {data?.prev_day && <> · <span className="text-ok">▼</span> / <span className="text-danger">▲</span> {t("changeSince")} <span dir="ltr">{data.prev_day}</span></>}
      </p>
    </div>
  );
}
