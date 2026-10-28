import { useEffect, useState } from "react";
import { ArrowRight, Coins, Gem, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Pills, Spinner, Tile, fmt } from "../ui.jsx";

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function range(p) {
  const now = new Date();
  const to = iso(now);
  if (p === "today") return [to, to];
  if (p === "week") { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return [iso(d), to]; } // Saturday start
  if (p === "month") return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), to];
  return [`${now.getFullYear()}-01-01`, to];
}

function Stat({ icon: Icon, label, value, unit, tone }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-dim">
        <Icon size={13} /> {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${tone || "text-ink"}`} dir="ltr">
        {tone && value > 0 ? "+" : ""}{fmt(value, unit === "g" ? 2 : 0)}
        <span className="ms-1 text-sm font-medium text-faint">{unit}</span>
      </div>
    </div>
  );
}

function MetalBlock({ title, icon: Icon, grad, sales, purchase, current, unit, t }) {
  const total = Math.max(sales + purchase, 1e-9);
  const pos = current > 0.0005 ? "text-ok" : current < -0.0005 ? "text-danger" : "text-faint";
  return (
    <div className="flex flex-col rounded-lg border border-line bg-panel p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`grid size-9 place-items-center rounded-xl text-white ${grad}`}><Icon size={18} /></span>
        <h4 className="text-lg font-semibold text-ink">{title}</h4>
        <span className={`ms-auto rounded-full px-3 py-1 text-xs font-semibold ${current >= 0 ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
          {t("kpiNet")}: <span dir="ltr">{current > 0 ? "+" : ""}{fmt(current, unit === "g" ? 2 : 0)} {unit}</span>
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={TrendingUp} label={t("netSales")} value={sales} unit={unit} />
        <Stat icon={TrendingDown} label={t("netPurchase")} value={purchase} unit={unit} />
        <Stat icon={Icon} label={t("current")} value={current} unit={unit} tone={pos} />
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-[11px] text-dim">
          <span>{t("netSales")} {fmt((sales / total) * 100, 0)}%</span>
          <span>{fmt((purchase / total) * 100, 0)}% {t("netPurchase")}</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-card" dir="ltr">
          <div className="bg-orange-500" style={{ width: `${(sales / total) * 100}%` }} />
          <div className="bg-neutral-700 dark:bg-neutral-400" style={{ width: `${(purchase / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

// Overview section: Gold & Silver sales vs purchase for a chosen period (from GERP summary).
export default function OverviewKpi() {
  const { t } = useI18n();
  const [p, setP] = useState("month");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    setD(null); setErr("");
    const [from_date, to_date] = range(p);
    api.kpi({ from_date, to_date, branches: "", opening_gold_grams: 0, opening_gold_cash: 0, opening_silver: 0 })
      .then((x) => live && setD(x)).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [p]);

  const g = d?.gold_grams, s = d?.silver;
  return (
    <Tile title={t("kpiTitle")} className="" pad
      action={
        <div className="flex flex-wrap items-center gap-3">
          <Pills value={p} onChange={setP} options={[["today", t("pToday")], ["week", t("pWeek")], ["month", t("pMonth")], ["year", t("pYear")]]} />
          <a href="#/kpi" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">{t("kpiFull")} <ArrowRight size={12} className="rtl:rotate-180" /></a>
        </div>
      }>
      {err ? <p className="py-6 text-center text-sm text-danger">{err}</p>
        : !d ? <Spinner label={t("loading")} />
        : (
          <div className="grid gap-4 lg:grid-cols-2">
            <MetalBlock title={t("gold")} icon={Coins} grad="bg-gradient-to-t from-orange-500 to-orange-600" unit="g"
              sales={g.net_sales} purchase={g.net_purchase} current={g.current} t={t} />
            <MetalBlock title={t("silver")} icon={Gem} grad="bg-gradient-to-t from-slate-500 to-slate-300" unit="g"
              sales={s.sales} purchase={s.purchase} current={s.current} t={t} />
          </div>
        )}
    </Tile>
  );
}
