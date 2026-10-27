import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import LedgerView from "./LedgerView.jsx";
import { Btn, CustName, ErrorBox, Field, Modal, Spinner, custName, fmt, inputCls, todayISO } from "../ui.jsx";

// key -> [i18n key, digits, bilingual label for print]
const ROWS = {
  sar: ["stSar", 2, "ريال سعودي / SAR"], c24: ["stC24", 2, "عيار 24 / 24K"], c22: ["stC22", 2, "عيار 22 / 22K"],
  c21: ["stC21", 2, "عيار 21 / 21K"], c18: ["stC18", 2, "عيار 18 / 18K"],
  gold24: ["stGold24", 2, "الإجمالي بعيار 24 / Total in 24K"], silver: ["stSilver", 2, "فضة / Silver"],
};
const GOLD_KEYS = ["c24", "c22", "c21", "c18"];

// Balance = debit - credit. Positive => customer owes us.
const tone = (n) => (n > 0.0005 ? "text-danger" : n < -0.0005 ? "text-brand" : "text-faint");
const dmy = (iso) => (iso ? iso.split("-").reverse().join("-") : "");
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Zero carat rows (22K etc.) print mein bhi dikhte hain par halke; poori khali gold rows chhupa sakte hain
const visibleRows = (st) => st.rows.filter((r) => !(GOLD_KEYS.includes(r.key) && !r.opening && !r.debit && !r.credit && !r.closing));

function printStatement(st, t, isAr) {
  const ci = st.company_info || {};
  const origin = window.location.origin;
  const cname = esc(custName(st.customer, isAr));
  const bal = (v, bold) => `<td dir="ltr" class="n${bold ? " b" : ""}${bold && v > 0.0005 ? " pos" : bold && v < -0.0005 ? " neg" : ""}">${fmt(v, 2)}</td>`;
  const body = visibleRows(st).map((r) => {
    const [, , label] = ROWS[r.key];
    const [arL, enL] = label.split(" / ");
    const total = r.key === "gold24" ? " class=\"tot\"" : "";
    return `<tr${total}><td><div dir="rtl" style="text-align:left">${esc(arL)}</div><div dir="ltr">${esc(enL)}</div></td>${bal(r.opening)}${bal(r.debit)}${bal(r.credit)}${bal(r.closing, true)}</tr>`;
  }).join("");
  const sar = st.rows.find((r) => r.key === "sar"), g24 = st.rows.find((r) => r.key === "gold24");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Statement - ${esc(st.customer.code)}</title>
<style>
  @page{size:A4 landscape;margin:12mm}
  *{box-sizing:border-box} body{font-family:"IBM Plex Sans","IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;color:#111;margin:0;font-size:12px}
  .head{display:grid;grid-template-columns:1fr 160px 1fr;align-items:start;gap:12px;margin-bottom:6px}
  .head .l{text-align:left} .head .r{text-align:right} .head .m{text-align:center}
  .head img{height:62px} .code{font-weight:700;font-size:14px} .nm{font-weight:600;margin-top:4px;unicode-bidi:plaintext}
  .co{font-weight:700;font-size:13px} .sm{font-size:11px;margin-top:3px}
  h1{font-size:16px;text-align:center;margin:14px 0 2px} .per{text-align:center;font-weight:700;margin-bottom:14px}
  table{width:100%;border-collapse:collapse} th{background:#f9cf8f;border:1px solid #c9a15f;padding:7px 8px;font-size:11px}
  td{border:1px solid #d9c9a8;padding:8px 10px} td.n{text-align:right;font-variant-numeric:tabular-nums} td.b{font-weight:700}
  .pos{color:#b3142e} .neg{color:#3d37c9} tr.tot td{background:#fff3df;font-weight:700}
  td:first-child{font-weight:600;white-space:nowrap;line-height:1.35}
  .cur{display:flex;gap:30px;margin-top:16px;font-weight:700} .cur div{border:1px solid #c9a15f;background:#fff3df;padding:8px 14px;border-radius:6px}
  .foot{margin-top:18px;font-size:10.5px;color:#444} .eoe{font-weight:700;font-size:13px;margin-top:10px}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="head">
  <div class="l"><div class="code" dir="ltr">${esc(st.customer.code)}</div><div class="nm">${cname}</div></div>
  <div class="m"><img src="${origin}/swag-mark.png" alt=""></div>
  <div class="r">
    ${ci.legal_name ? `<div class="co" dir="rtl">${esc(ci.legal_name)}</div>` : ""}
    <div class="co">${esc(ci.legal_name_en || ci.name || "")}</div>
    ${ci.vat ? `<div class="sm" dir="rtl">الرقم الضريبي : <span dir="ltr">${esc(ci.vat)}</span></div>` : ""}
    ${ci.address ? `<div class="sm" dir="rtl">${esc(ci.address)}</div>` : ""}
    ${ci.address_en ? `<div class="sm">${esc(ci.address_en)}</div>` : ""}
  </div>
</div>
<h1>Statement Of Account / كشف الحساب</h1>
<div class="per">Date From ${dmy(st.from_date)} To ${dmy(st.to_date)}</div>
<table><thead><tr><th style="text-align:left">Currency / Karat — العملة / العيار</th><th>Opening<br>الافتتاحي</th><th>Debit<br>المدين</th><th>Credit<br>الدائن</th><th>Balance<br>الرصيد</th></tr></thead><tbody>${body}</tbody></table>
<div class="cur"><div>الرصيد الحالي / Current balance — SAR: <span dir="ltr">${fmt(sar.closing, 2)}</span></div><div>24K: <span dir="ltr">${fmt(g24.closing, 2)} g</span></div></div>
<div class="eoe">(E.O.E)</div>
<div class="foot">${esc(t("stNoteLines"))}<br>Balance = Debit − Credit · ${esc(t("stmtOwes"))}: + · ${esc(t("stmtWeOwe"))}: − · ${esc(t("generatedAt"))}: <span dir="ltr">${esc(st.generated_at.replace("T", " "))}</span></div>
<script>window.onload=function(){var i=document.querySelector("img");var go=function(){setTimeout(function(){window.print()},250)};if(i&&!i.complete){i.onload=go;i.onerror=go}else{go()}}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export default function StatementModal({ id, onClose }) {
  const { t, isAr } = useI18n();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(todayISO());
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [xl, setXl] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("summary");
  const [nonce, setNonce] = useState(0);

  const run = useCallback(async () => {
    setBusy(true);
    setErr("");
    try { setSt(await api.statement(id, { from_date: from, to_date: to })); }
    catch (e) { setErr(e.message || t("statementFailed")); setSt(null); }
    finally { setBusy(false); }
  }, [id, from, to, t]);
  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const excel = async () => {
    setXl(true);
    try { await api.statementXlsx(id, { from_date: from, to_date: to }, `statement-${st?.customer?.code || id}-${to}.xlsx`); }
    catch (e) { setErr(e.message); }
    finally { setXl(false); }
  };

  const rows = st ? visibleRows(st) : [];
  const allZero = st && st.rows.every((r) => !r.opening && !r.debit && !r.credit && !r.closing);

  return (
    <Modal title={t("statementTitle")} onClose={onClose} width={tab === "ledger" ? "max-w-6xl" : "max-w-3xl"}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={t("from")}><input type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={t("to")}><input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          <Btn variant="primary" onClick={() => { run(); setNonce((n) => n + 1); }} loading={busy} className="col-span-2 sm:col-span-1">{t("generate")}</Btn>
        </div>
        <div className="inline-flex rounded-lg bg-card p-1 text-xs font-semibold" role="tablist">
          {[["summary", "tabSummary"], ["ledger", "tabLedger"]].map(([k, key]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 ${tab === k ? "bg-panel text-ink shadow-card" : "text-dim hover:text-ink"}`}>{t(key)}</button>
          ))}
        </div>
        <ErrorBox>{err}</ErrorBox>
        {tab === "ledger" && <LedgerView id={id} from={from} to={to} nonce={nonce} />}
        {tab === "summary" && busy && !st && <Spinner label={t("loading")} />}
        {tab === "summary" && st && (
          <>
            <div className="rounded-xl border border-line bg-card p-3 text-sm">
              <div className="font-semibold"><CustName c={st.customer} isAr={isAr} /></div>
              <div className="text-xs text-dim" dir="ltr">{st.company && <b className="text-brand">{st.company} · </b>}{st.customer.code} · {st.from_date} → {st.to_date}</div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-card text-[11px] uppercase tracking-wide text-dim">
                  <tr>
                    <th className="px-3 py-2 text-start" />
                    <th className="px-3 py-2 text-end">{t("opening")}</th>
                    <th className="px-3 py-2 text-end">{t("periodDebit")}</th>
                    <th className="px-3 py-2 text-end">{t("periodCredit")}</th>
                    <th className="px-3 py-2 text-end">{t("closing")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const [label, dg] = ROWS[r.key];
                    const total = r.key === "gold24";
                    return (
                      <tr key={r.key} className={`border-t border-line ${total ? "bg-gold-soft font-semibold" : ""}`}>
                        <td className="px-3 py-2.5 font-medium">{t(label)}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{fmt(r.opening, dg)}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{fmt(r.debit, dg)}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums" dir="ltr">{fmt(r.credit, dg)}</td>
                        <td className={`px-3 py-2.5 text-end font-bold tabular-nums ${tone(r.closing)}`} dir="ltr">{fmt(r.closing, dg)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {allZero && <p className="text-xs text-faint">{t("noMovement")}</p>}
            {st.reconciled === true && <p className="text-xs text-ok">✓ {t("reconciledOk")}</p>}
            {st.reconciled === false && <p className="text-xs text-warn">⚠ {t("reconciledNo")}</p>}
            <p className="text-[11px] text-faint">{t("stNoteLines")}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Btn onClick={excel} loading={xl}><Download size={14} /> {t("downloadExcel")}</Btn>
              <Btn variant="primary" onClick={() => { if (!printStatement(st, t, isAr)) setErr("Popup blocked: allow popups for this site"); }}>
                <Printer size={14} /> {t("printPdf")}
              </Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
