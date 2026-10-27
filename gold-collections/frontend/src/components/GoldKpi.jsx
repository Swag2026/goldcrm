import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Badge, Btn, Card, ErrorBox, Field, Spinner, fmt, inputCls, todayISO } from "../ui.jsx";

// PDF rule: positive = green, negative = red
const tone = (n) => (n > 0 ? "text-ok" : n < 0 ? "text-danger" : "text-faint");
const toneBg = (n) => (n > 0 ? "bg-ok-soft border-ok/25" : n < 0 ? "bg-danger-soft border-danger/25" : "bg-panel border-line");

function KpiCard({ title, value, unit, hint, colored }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-card ${colored ? toneBg(value) : "bg-panel border-line"}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-dim">{title}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${colored ? tone(value) : "text-ink"}`} dir="ltr">
        {colored && value > 0 ? "+" : ""}{fmt(value)}
        {unit && <span className="ms-1 text-sm font-medium text-faint">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  );
}

function Breakdown({ title, rows }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={r.bold ? "border-t border-line font-semibold" : ""}>
              <td className="py-1.5 pe-4 text-dim">{r.label}</td>
              <td className={`py-1.5 text-end tabular-nums ${r.sign ? tone(r.value) : ""}`} dir="ltr">{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function GoldKpi() {
  const { t } = useI18n();
  const [f, setF] = useState({
    from: `${new Date().getFullYear()}-01-01`, to: todayISO(), branches: "",
    og: 0, oc: 0, os: 0,
  });
  const [mode, setMode] = useState("grams");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const load = useCallback(async () => {
    setBusy(true);
    setErr("");
    try {
      setD(await api.kpi({
        from_date: f.from, to_date: f.to, branches: f.branches,
        opening_gold_grams: f.og || 0, opening_gold_cash: f.oc || 0, opening_silver: f.os || 0,
      }));
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }, [f]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const g = d ? d[mode === "grams" ? "gold_grams" : "gold_cash"] : null;
  const unit = mode === "grams" ? t("grams") : "";
  const s = d?.silver;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold">{t("kpiTitle")}</h1>
        {d?.mock && <Badge tone="warn">{t("demoData")}</Badge>}
      </div>

      <Card className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-7">
        <Field label={t("from")}><input type="date" className={inputCls} value={f.from} onChange={set("from")} /></Field>
        <Field label={t("to")}><input type="date" className={inputCls} value={f.to} onChange={set("to")} /></Field>
        <Field label={t("branches")}><input className={inputCls} value={f.branches} placeholder="1,2" onChange={set("branches")} /></Field>
        <Field label={t("openGold")}><input type="number" className={inputCls} value={f.og} onChange={set("og")} /></Field>
        <Field label={t("openGoldCash")}><input type="number" className={inputCls} value={f.oc} onChange={set("oc")} /></Field>
        <Field label={t("openSilver")}><input type="number" className={inputCls} value={f.os} onChange={set("os")} /></Field>
        <div className="flex items-end"><Btn variant="primary" className="w-full" onClick={load} loading={busy}>{t("apply")}</Btn></div>
      </Card>

      <ErrorBox>{err}</ErrorBox>
      {!d && !err && <Spinner label={t("loading")} />}

      {d && g && s && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">🥇 {t("goldKpi")}</h2>
            <div className="inline-flex rounded-lg bg-card p-1 text-xs font-semibold">
              {[["grams", "gramsMode"], ["cash", "cashMode"]].map(([m, k]) => (
                <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-panel text-ink shadow-card" : "text-dim"}`}>{t(k)}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title={t("netSales")} value={g.net_sales} unit={unit} />
            <KpiCard title={t("netPurchase")} value={g.net_purchase} unit={unit} />
            <KpiCard title={t("current")} value={g.current} unit={unit} hint="Net Sales − Net Purchase" colored />
            <KpiCard title={t("netProfit")} value={g.net_profit} unit={unit} hint="Current − Opening" colored />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown title={t("sales")} rows={[
              { label: t("cashSales"), value: g.sales_cash }, { label: t("dueSales"), value: g.sales_due },
              { label: t("internalSales"), value: g.sales_internal },
              { label: t("returnsCash"), value: -g.returns_cash, sign: true }, { label: t("returnsDue"), value: -g.returns_due, sign: true },
              { label: t("netSales"), value: g.net_sales, bold: true, sign: true },
            ]} />
            <Breakdown title={t("purchases")} rows={[
              { label: t("cashPurchases"), value: g.purchase_cash }, { label: t("duePurchases"), value: g.purchase_due },
              { label: t("internalPurchases"), value: g.purchase_internal },
              { label: t("returnsCash"), value: -g.preturns_cash, sign: true }, { label: t("returnsDue"), value: -g.preturns_due, sign: true },
              { label: t("netPurchase"), value: g.net_purchase, bold: true, sign: true },
            ]} />
          </div>

          <h2 className="text-lg font-semibold">🥈 {t("silverKpi")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title={t("sales")} value={s.sales} unit={t("grams")} />
            <KpiCard title={t("purchase")} value={s.purchase} unit={t("grams")} />
            <KpiCard title={t("current")} value={s.current} unit={t("grams")} hint="Sales − Purchase" colored />
            <KpiCard title={t("netProfit")} value={s.net_profit} unit={t("grams")} hint="Current − Opening" colored />
          </div>
          {d.missing_codes?.length > 0 && (
            <p className="text-xs text-faint">{t("missingCodes")}: <span dir="ltr">{d.missing_codes.join(", ")}</span></p>
          )}
        </>
      )}
    </div>
  );
}
