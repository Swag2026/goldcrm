import { useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import { motion } from "motion/react";
import { Banknote, CheckCheck, Coins, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { useI18n } from "../i18n.jsx";
import { CustName, DeltaChip, Sparkline, fmt } from "../ui.jsx";

const reveal = {
  visible: (i) => ({ y: 0, opacity: 1, filter: "blur(0px)", transition: { delay: i * 0.4, duration: 0.5 } }),
  hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
};

const ORANGE_GRAD = "bg-gradient-to-t from-orange-500 via-orange-400 to-orange-600";

function BillingSwitch({ value, onChange, labels }) {
  return (
    <div className="relative z-10 flex w-fit rounded-xl border border-line bg-card p-1">
      {labels.map(([id, label, badge]) => (
        <button key={id} onClick={() => onChange(id)}
          className={cn("relative z-10 h-12 w-fit cursor-pointer rounded-xl px-3 py-1 text-sm font-medium transition-colors sm:px-6 sm:py-2 sm:text-base",
            value === id ? "text-white" : "text-dim hover:text-ink")}>
          {value === id && (
            <motion.span layoutId="switch" transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cn("absolute left-0 top-0 h-12 w-full rounded-xl border-4 border-orange-600 shadow-sm shadow-orange-600", ORANGE_GRAD)} />
          )}
          <span className="relative flex items-center gap-2">
            {label}
            {badge && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-black">{badge}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

function PlanCard({ plan, mode, t, isAr, openCustomer }) {
  const receive = mode === "receive";
  const value = receive ? plan.receivable : plan.payable;
  const dg = plan.digits;
  const list = receive ? plan.top : plan.stats;
  return (
    <div className={cn("relative flex h-full flex-col rounded-lg border shadow-sm",
      plan.popular
        ? "border-line bg-orange-50 ring-2 ring-orange-500 dark:bg-orange-500/10"
        : "border-line bg-panel")}>
      <div className="flex flex-col space-y-1.5 p-6 text-start">
        <div className="flex justify-between">
          <h3 className="mb-2 flex items-center gap-3 text-2xl font-semibold text-ink xl:text-3xl">
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-md", plan.iconBg)}><plan.icon size={20} /></span>
            {plan.name}
          </h3>
          {plan.popular && (
            <div><span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white">{t("planMain")}</span></div>
          )}
        </div>
        <p className="mb-4 min-h-10 text-sm text-dim">{plan.desc}</p>
        <div className="flex items-baseline" dir="ltr">
          <NumberFlow value={value} format={{ minimumFractionDigits: dg, maximumFractionDigits: dg }}
            className={cn("text-4xl font-semibold tabular-nums", receive ? "text-ink" : "text-orange-600")} />
          <span className="ml-1 text-dim">{plan.unit}</span>
        </div>
        <div className="flex min-h-[22px] items-center gap-2">
          {receive ? <DeltaChip value={plan.delta} digits={dg} unit={plan.unit} since={plan.since} /> : <span className="text-xs text-faint">{t("weOweTotal")}</span>}
        </div>
      </div>

      <div className="mt-auto p-6 pt-0">
        <button onClick={() => { window.location.hash = "#/customers?flt=with_balance"; }}
          className={cn("mb-4 w-full rounded-xl border p-4 text-xl text-white shadow-lg",
            plan.popular
              ? "border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 shadow-orange-500/50"
              : "border-neutral-700 bg-gradient-to-t from-neutral-900 to-neutral-600 shadow-neutral-900/40")}>
          {t("viewCustomers")}
        </button>
        <button onClick={() => { window.location.hash = "#/myday"; }}
          className="mb-6 w-full rounded-xl border border-line bg-panel p-4 text-xl text-ink shadow-lg shadow-black/5">
          {t("navMyDay")}
        </button>

        <div className="space-y-3 border-t border-line pt-4">
          <h2 className="mb-3 text-xl font-semibold uppercase text-ink">{t("planFeatures")}</h2>
          <h4 className="mb-3 text-base font-medium text-ink">{receive ? t("planTop") : t("planStats")}</h4>
          <ul className="min-h-[9.5rem] space-y-2 font-semibold">
            {list.map((f, i) => (
              <li key={i} className="flex items-center">
                <span className="me-3 mt-0.5 grid h-6 w-6 shrink-0 place-content-center rounded-full border border-orange-500 bg-panel">
                  <CheckCheck className="h-4 w-4 text-orange-500" />
                </span>
                {f.id ? (
                  <button onClick={() => openCustomer(f.id)} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-start text-sm text-dim hover:text-orange-600">
                    <span className="min-w-0 flex-1"><CustName c={f} isAr={isAr} clamp /></span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-ink" dir="ltr">{fmt(f.value, dg)}</span>
                  </button>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm text-dim">
                    <span>{f.label}</span><span className="text-xs font-semibold tabular-nums text-ink" dir="ltr">{f.value}</span>
                  </span>
                )}
              </li>
            ))}
            {list.length === 0 && <li className="text-sm text-faint">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function MetalPlans({ d, greet, user, openCustomer, since, sp }) {
  const { t, isAr } = useI18n();
  const ref = useRef(null);
  const [mode, setMode] = useState("receive");
  const T = d.totals, ch = d.changes;
  const top3 = (rows) => rows.slice(0, 3);

  const plans = [
    {
      key: "gold", name: t("gold"), popular: true, icon: Coins, iconBg: "bg-gradient-to-t from-orange-500 to-orange-600 shadow-orange-500/30", desc: t("planGoldDesc"), unit: t("grams"), digits: 2,
      receivable: T.gold_receivable, payable: T.gold_payable, delta: ch?.gold_receivable ?? null, since,
      top: top3(d.top_gold),
      stats: [{ label: t("goldReceivable"), value: `${fmt(T.gold_receivable)} ${t("grams")}` }, { label: t("debtors"), value: T.debtors }],
    },
    {
      key: "cash", name: t("cash"), icon: Banknote, iconBg: "bg-gradient-to-t from-emerald-600 to-emerald-500 shadow-emerald-500/30", desc: t("planCashDesc"), unit: t("sar"), digits: 0,
      receivable: T.cash_receivable, payable: T.cash_payable, delta: ch?.cash_receivable ?? null, since,
      top: top3(d.top_cash),
      stats: [{ label: t("cashReceivable"), value: fmt(T.cash_receivable, 0) }, { label: t("debtors"), value: T.debtors }],
    },
    {
      key: "silver", name: t("silver"), icon: Gem, iconBg: "bg-gradient-to-t from-slate-500 to-slate-300 shadow-slate-400/40", desc: t("planSilverDesc"), unit: t("grams"), digits: 0,
      receivable: T.silver_receivable, payable: T.silver_payable, delta: ch?.silver_receivable ?? null, since,
      top: [],
      stats: [{ label: t("silverReceivable"), value: `${fmt(T.silver_receivable, 0)} ${t("grams")}` }, { label: t("debtors"), value: T.debtors }],
    },
  ];

  return (
    <section ref={ref} className="relative">
      <article className="mb-6 max-w-3xl space-y-4 text-start">
        <h2 className="mb-4 text-4xl font-medium capitalize text-ink md:text-5xl">
          <VerticalCutReveal key={`${greet}-${user.name}`} splitBy="words" staggerDuration={0.15} staggerFrom="first" reverse
            containerClassName="justify-start" transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0 }}>
            {`${greet}, ${user.name}`}
          </VerticalCutReveal>
        </h2>
        <TimelineContent as="p" animationNum={0} timelineRef={ref} customVariants={reveal} className="w-[80%] text-sm text-dim md:text-base">
          {t("overviewSub")}
        </TimelineContent>
        <TimelineContent as="div" animationNum={1} timelineRef={ref} customVariants={reveal}>
          <div className="flex"><BillingSwitch value={mode} onChange={setMode} labels={[["receive", t("modeReceive")], ["pay", t("modePay")]]} /></div>
        </TimelineContent>
      </article>

      <div className="grid gap-4 py-6 md:grid-cols-3">
        {plans.map((p, i) => (
          <TimelineContent key={p.key} as="div" animationNum={2 + i} timelineRef={ref} customVariants={reveal} className="h-full">
            <PlanCard plan={p} mode={mode} t={t} isAr={isAr} openCustomer={openCustomer} />
          </TimelineContent>
        ))}
      </div>
    </section>
  );
}
