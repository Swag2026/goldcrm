import { useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Btn, ErrorBox, Spinner, custName, fmt, inputCls } from "../ui.jsx";

const KLABEL = { 18: "18K", 21: "21K", 22: "22K", 24: "24K", silver: "Silver", platinum: "Platinum", palladium: "Palladium" };
const dmy = (iso) => (iso ? iso.split("-").reverse().join("-") : "");
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const zero = (n) => !n || Math.abs(n) < 0.0005;
const num = (n, d = 2) => (zero(n) ? "—" : fmt(n, d));

function printLedger(led, lines, metals, t, isAr) {
  const ci = led.company_info || {};
  const origin = window.location.origin;
  const head2 = metals.map((k) => `<th colspan="3" class="k k${k}">${esc(KLABEL[k])}</th>`).join("");
  const head3 = metals.map((k) => `<th class="k k${k}">Debit<br>مدين</th><th class="k k${k}">Credit<br>دائن</th><th class="k k${k}">Balance<br>الرصيد</th>`).join("");
  const cell = (v, d = 2, b = false) => `<td dir="ltr" class="n${b ? " b" : ""}">${zero(v) ? "" : fmt(v, d)}</td>`;
  const body = lines.map((l) => `<tr><td>${esc(l.index)}</td><td dir="ltr">${esc(dmy(l.date))}</td><td dir="ltr">${esc(l.voucher_no)}</td>
    <td>${esc(l.type)}<div class="ar" dir="rtl">${esc(l.type_ar)}</div></td><td class="rm" dir="auto">${esc(l.remarks)}</td>
    ${cell(l.debit)}${cell(l.credit)}${cell(l.balance, 2, true)}
    ${metals.map((k) => cell(l.metals[k].debit) + cell(l.metals[k].credit) + cell(l.metals[k].balance, 2, true)).join("")}</tr>`).join("");
  const tot = led.totals;
  const totRow = `<tr class="tot"><td colspan="5" style="text-align:end">Total / الإجمالي</td>${cell(tot.cash.debit, 2, true)}${cell(tot.cash.credit, 2, true)}${cell(tot.cash.balance, 2, true)}
    ${metals.map((k) => cell(tot[k].debit, 2, true) + cell(tot[k].credit, 2, true) + cell(tot[k].balance, 2, true)).join("")}</tr>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ledger - ${esc(led.customer.code)}</title>
<style>
  @page{size:A4 landscape;margin:8mm} *{box-sizing:border-box}
  body{font-family:"IBM Plex Sans","IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;color:#111;margin:0;font-size:9.5px}
  .head{display:grid;grid-template-columns:1fr 130px 1fr;align-items:start;gap:10px;margin-bottom:4px}
  .head .l{text-align:left}.head .r{text-align:right}.head .m{text-align:center}.head img{height:52px}
  .code{font-weight:700;font-size:12px}.nm{font-weight:600;margin-top:3px;unicode-bidi:plaintext}.co{font-weight:700;font-size:11px}.sm{font-size:9.5px;margin-top:2px}
  h1{font-size:14px;text-align:center;margin:8px 0 1px}.per{text-align:center;font-weight:700;margin-bottom:8px}
  table{width:100%;border-collapse:collapse}
  th{background:#f9cf8f;border:1px solid #c9a15f;padding:4px 3px;font-size:8.5px}
  th.k{background:#fde8b8} th.k24,th.k22{background:#ffd36b} th.k21{background:#f7de9a}
  td{border:1px solid #d9c9a8;padding:3px 4px;vertical-align:top} td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap} td.b{font-weight:700}
  .ar{font-size:8.5px;color:#555} td.rm{max-width:190px;word-break:break-word}
  tr.tot td{background:#fff3df;font-weight:700} thead{display:table-header-group} tr{page-break-inside:avoid}
  .foot{margin-top:8px;font-size:9px;color:#444}.eoe{font-weight:700;margin-top:6px}
</style></head><body>
<div class="head">
  <div class="l"><div class="code" dir="ltr">${esc(led.customer.code)}</div><div class="nm">${esc(custName(led.customer, isAr))}</div></div>
  <div class="m"><img src="${origin}/swag-mark.png" alt=""></div>
  <div class="r">${ci.legal_name ? `<div class="co" dir="rtl">${esc(ci.legal_name)}</div>` : ""}<div class="co">${esc(ci.legal_name_en || ci.name || "")}</div>
    ${ci.vat ? `<div class="sm" dir="rtl">الرقم الضريبي : <span dir="ltr">${esc(ci.vat)}</span></div>` : ""}
    ${ci.address ? `<div class="sm" dir="rtl">${esc(ci.address)}</div>` : ""}${ci.address_en ? `<div class="sm">${esc(ci.address_en)}</div>` : ""}</div>
</div>
<h1>Statement Of Account / كشف الحساب</h1><div class="per">Date From ${dmy(led.from_date)} To ${dmy(led.to_date)}</div>
<table><thead><tr><th rowspan="2">#</th><th rowspan="2">Date<br>التاريخ</th><th rowspan="2">Voucher No<br>رقم المستند</th><th rowspan="2">Type<br>النوع</th><th rowspan="2">Remarks<br>البيان</th><th colspan="3">SAR / س ر</th>${head2}</tr>
<tr><th>Debit<br>مدين</th><th>Credit<br>دائن</th><th>Balance<br>الرصيد</th>${head3}</tr></thead><tbody>${body}${totRow}</tbody></table>
<div class="eoe">(E.O.E)</div>
<div class="foot">Balance = Debit − Credit · ${esc(t("stmtOwes"))}: + · ${esc(t("stmtWeOwe"))}: − · ${esc(t("generatedAt"))}: <span dir="ltr">${esc(led.generated_at.replace("T", " "))}</span></div>
<script>window.onload=function(){var i=document.querySelector("img");var go=function(){setTimeout(function(){window.print()},300)};if(i&&!i.complete){i.onload=go;i.onerror=go}else{go()}}</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open(); w.document.write(html); w.document.close();
  return true;
}

export default function LedgerView({ id, from, to, nonce }) {
  const { t, isAr } = useI18n();
  const [led, setLed] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [showK, setShowK] = useState(true);
  const [xl, setXl] = useState(false);

  useEffect(() => {
    let live = true;
    setBusy(true); setErr(""); setLed(null);
    api.ledger(id, { from_date: from, to_date: to })
      .then((d) => live && setLed(d))
      .catch((e) => live && setErr(/501|not available|available nahi/i.test(e.message) ? t("ledgerUnavailable") : e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, nonce]);

  const lines = useMemo(() => {
    if (!led) return [];
    const ql = q.trim().toLowerCase();
    return led.lines.filter((l) => (!type || l.type === type) && (!ql || `${l.voucher_no} ${l.remarks} ${l.type}`.toLowerCase().includes(ql)));
  }, [led, type, q]);
  const metals = led && showK ? led.active_metals : [];
  const filtered = led && (type || q.trim());

  const excel = async () => {
    setXl(true);
    try { await api.ledgerXlsx(id, { from_date: from, to_date: to }, `ledger-${led?.customer?.code || id}-${to}.xlsx`); }
    catch (e) { setErr(e.message); }
    finally { setXl(false); }
  };

  if (busy) return <Spinner label={t("loading")} />;
  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!led) return null;
  const stale = led.vs_synced && (Math.abs(led.vs_synced.cash) > 1 || Math.abs(led.vs_synced.gold) > 0.02); // GERP gold balance 2 decimal mein deta hai
  const th = "whitespace-nowrap px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-dim";
  const kBg = { 18: "bg-[#fde8b8]/40", 21: "bg-[#f7de9a]/40", 22: "bg-[#ffd36b]/30", 24: "bg-[#ffd36b]/30", silver: "bg-slate-200/40", platinum: "bg-slate-200/40", palladium: "bg-slate-200/40" };

  return (
    <div className="space-y-3">
      {stale && <div className="rounded-lg border border-warn/30 bg-warn-soft p-2.5 text-xs text-warn">⚠ {t("ledgerFresher")}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} !w-auto`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("allTypes")}</option>
          {led.types.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
        </select>
        <input className={`${inputCls} !w-auto min-w-[200px] flex-1`} placeholder={t("searchLedger")} value={q} onChange={(e) => setQ(e.target.value)} />
        {led.active_metals.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-dim"><input type="checkbox" checked={showK} onChange={(e) => setShowK(e.target.checked)} /> {t("karatCols")}</label>
        )}
        <span className="text-xs text-faint">{lines.length}{filtered ? ` / ${led.lines.length}` : ""} {t("ledgerLines")}</span>
      </div>

      {lines.length === 0 ? <p className="p-6 text-center text-sm text-faint">{t("ledgerEmpty")}</p> : (
        <div className="max-h-[52vh] overflow-auto rounded-xl border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className={`${th} text-start`}>#</th><th className={`${th} text-start`}>{t("colDate")}</th>
                <th className={`${th} text-start`}>{t("colVoucher")}</th><th className={`${th} text-start`}>{t("colType")}</th>
                <th className={`${th} text-start`}>{t("colRemarks")}</th>
                <th className={`${th} text-end`}>{t("colDebit")}</th><th className={`${th} text-end`}>{t("colCredit")}</th><th className={`${th} text-end`}>{t("colBalance")}</th>
                {metals.map((k) => ["Debit", "Credit", "Balance"].map((c) => (
                  <th key={k + c} className={`${th} text-end ${kBg[k]}`}>{KLABEL[k]} {c}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.index + l.voucher_no} className="border-t border-line align-top hover:bg-hover">
                  <td className="px-2 py-1.5 text-faint">{l.index}</td>
                  <td className="whitespace-nowrap px-2 py-1.5" dir="ltr">{l.date}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-medium" dir="ltr">{l.voucher_no}</td>
                  <td className="px-2 py-1.5"><div>{l.type}</div>{l.type_ar && <div className="text-[10px] text-faint" dir="rtl">{l.type_ar}</div>}</td>
                  <td className="min-w-[160px] max-w-[260px] px-2 py-1.5 text-dim [unicode-bidi:plaintext]">{l.remarks}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums" dir="ltr">{num(l.debit)}</td>
                  <td className="px-2 py-1.5 text-end tabular-nums" dir="ltr">{num(l.credit)}</td>
                  <td className={`px-2 py-1.5 text-end font-semibold tabular-nums ${l.balance > 0.5 ? "text-danger" : l.balance < -0.5 ? "text-brand" : "text-faint"}`} dir="ltr">{fmt(l.balance, 2)}</td>
                  {metals.map((k) => [l.metals[k].debit, l.metals[k].credit, l.metals[k].balance].map((v, ix) => (
                    <td key={k + ix} className={`px-2 py-1.5 text-end tabular-nums ${kBg[k]} ${ix === 2 ? "font-semibold" : ""}`} dir="ltr">{num(v)}</td>
                  )))}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-gold-soft font-bold">
              <tr className="border-t-2 border-line">
                <td colSpan={5} className="px-2 py-2 text-end">{t("ledgerTotal")}</td>
                <td className="px-2 py-2 text-end tabular-nums" dir="ltr">{fmt(led.totals.cash.debit)}</td>
                <td className="px-2 py-2 text-end tabular-nums" dir="ltr">{fmt(led.totals.cash.credit)}</td>
                <td className="px-2 py-2 text-end tabular-nums" dir="ltr">{fmt(led.totals.cash.balance)}</td>
                {metals.map((k) => [led.totals[k].debit, led.totals[k].credit, led.totals[k].balance].map((v, ix) => (
                  <td key={k + ix} className="px-2 py-2 text-end tabular-nums" dir="ltr">{num(v)}</td>
                )))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Btn onClick={excel} loading={xl}><Download size={14} /> {t("downloadExcel")}</Btn>
        <Btn variant="primary" onClick={() => { if (!printLedger(led, lines, metals, t, isAr)) setErr("Popup blocked: allow popups for this site"); }}>
          <Printer size={14} /> {t("printPdf")}
        </Btn>
      </div>
    </div>
  );
}
