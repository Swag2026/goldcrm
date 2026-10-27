import { useCallback, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Btn, ErrorBox, Field, Modal, Spinner, CustName, custName, fmt, inputCls, todayISO } from "../ui.jsx";

const ROWS = [["gold", "gold", 2, "grams"], ["cash", "cash", 2, "sar"], ["silver", "silver", 2, "grams"]];

// Balance = debit - credit. Positive => customer owes us.
const tone = (n) => (n > 0.0005 ? "text-danger" : n < -0.0005 ? "text-brand" : "text-faint");

function printStatement(st, t, isAr) {
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const name = `<span style="unicode-bidi:plaintext">${esc(custName(st.customer, isAr))}</span>`;
  const rows = ROWS.map(([m, label, dg, unit]) => {
    const r = st.metals[m];
    const cell = (v, bold) => `<td dir="ltr" style="text-align:end;${bold ? "font-weight:700;" : ""}${v > 0.0005 && bold ? "color:#c0143c;" : ""}">${fmt(v, dg)}</td>`;
    return `<tr><td>${esc(t(label))} <small>${esc(t(unit))}</small></td>${cell(r.opening)}${cell(r.debit)}${cell(r.credit)}${cell(r.closing, true)}</tr>`;
  }).join("");
  const html = `<!doctype html><html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(t("statementTitle"))} - ${name}</title>
<style>
  body{font-family:"IBM Plex Sans","IBM Plex Sans Arabic",system-ui,sans-serif;color:#1c2233;margin:32px;}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#6b7280;font-size:12px;margin-bottom:18px}
  .box{border:1px solid #ece2e8;border-radius:10px;padding:14px 16px;margin-bottom:18px;display:flex;gap:32px;flex-wrap:wrap}
  .box b{display:block;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;font-size:13px} th,td{padding:10px 12px;border-bottom:1px solid #ece2e8}
  th{background:#f7f3f6;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;text-align:end} th:first-child,td:first-child{text-align:start}
  small{color:#9ca3af} .note{margin-top:16px;font-size:11px;color:#6b7280}
  @media print{body{margin:14mm}}
</style></head><body>
<h1>${esc(t("statementTitle"))}</h1><div class="sub">${esc(st.company || t("appName"))}</div>
<div class="box">
  <div><b>${esc(t("customer"))}</b>${name}</div>
  <div><b>${esc(t("code"))}</b><span dir="ltr">${esc(st.customer.code)}</span></div>
  <div><b>${esc(t("period"))}</b><span dir="ltr">${esc(st.from_date)} → ${esc(st.to_date)}</span></div>
  <div><b>${esc(t("generatedAt"))}</b><span dir="ltr">${esc(st.generated_at.replace("T", " "))}</span></div>
</div>
<table><thead><tr><th></th><th>${esc(t("opening"))}</th><th>${esc(t("periodDebit"))}</th><th>${esc(t("periodCredit"))}</th><th>${esc(t("closing"))}</th></tr></thead><tbody>${rows}</tbody></table>
<p class="note">${esc(t("stmtOwes"))}: + &nbsp;·&nbsp; ${esc(t("stmtWeOwe"))}: − &nbsp;·&nbsp; ${esc(t("balance"))} = ${esc(t("debit"))} − ${esc(t("credit"))}<br>${esc(t("stmtNote"))}</p>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
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

  return (
    <Modal title={t("statementTitle")} onClose={onClose} width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label={t("from")}><input type="date" className={inputCls} value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={t("to")}><input type="date" className={inputCls} value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          <Btn variant="primary" onClick={run} loading={busy} className="col-span-2 sm:col-span-1">{t("generate")}</Btn>
        </div>
        <ErrorBox>{err}</ErrorBox>
        {busy && !st && <Spinner label={t("loading")} />}
        {st && (
          <>
            <div className="rounded-xl border border-line bg-card p-3 text-sm">
              <div className="font-semibold"><CustName c={st.customer} isAr={isAr} /></div>
              <div className="text-xs text-dim" dir="ltr">{st.company && <b className="text-brand">{st.company} · </b>}{st.customer.code} · {st.from_date} → {st.to_date}</div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[480px] text-sm">
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
                  {ROWS.map(([m, label, dg, unit]) => {
                    const r = st.metals[m];
                    return (
                      <tr key={m} className="border-t border-line">
                        <td className="px-3 py-2.5 font-medium">{t(label)} <span className="text-[11px] font-normal text-faint">{t(unit)}</span></td>
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
            <p className="text-[11px] text-faint">{t("stmtNote")}</p>
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
