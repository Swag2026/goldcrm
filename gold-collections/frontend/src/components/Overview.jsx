import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, HandCoins, HelpCircle, History, MapPin, MessageCircle, Phone, RefreshCw, StickyNote, TrendingDown, UserX } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import {
  Badge, Btn, CountUp, DeltaChip, Empty, ErrorBox, Pills, Sparkline, Spinner, Tile, custName, fmt, useApp,
} from "../ui.jsx";

const tip = {
  contentStyle: { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text)" },
  cursor: { fill: "var(--card-hover)" },
};
const GOLD_SHADES = ["#b8860b", "#d19a1f", "#e0b44a", "#ecce85", "#f4e2b6"];
const KIND_ICON = { call: Phone, whatsapp: MessageCircle, visit: MapPin, note: StickyNote, other: HelpCircle };
const KIND_KEY = { call: "kCall", whatsapp: "kWhatsapp", visit: "kVisit", note: "kNote", other: "kOther" };
const OUT_KEY = { reached: "oReached", no_answer: "oNoAnswer", promised: "oPromised", refused: "oRefused", paid: "oPaid", other: "oOther" };
const OUT_TONE = { reached: "ok", paid: "ok", promised: "gold", no_answer: "warn", refused: "danger", other: "neutral" };

// ------------------------------------------------------------------ KPI tile
function KpiTile({ label, value, unit, digits = 0, delta, since, spark, color, sub, accent, hint }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-panel shadow-card ${accent ? "border-gold/40" : "border-line"}`}>
      {accent && <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-[#e0b44a] to-gold" />}
      <div className="p-5 pb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-dim">{label}</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`text-[28px] font-bold leading-none tabular-nums ${accent ? "text-gold" : "text-ink"}`}>
            <CountUp value={value} digits={digits} />
          </span>
          {unit && <span className="text-sm font-medium text-faint">{unit}</span>}
        </div>
        <div className="mt-2 flex min-h-[22px] flex-wrap items-center gap-2">
          <DeltaChip value={delta} digits={digits} unit={unit} since={since} />
          {delta === null || delta === undefined ? <span className="text-[11px] text-faint">{hint}</span> : null}
        </div>
        {sub && <div className="mt-1 text-xs text-dim">{sub}</div>}
      </div>
      <Sparkline data={spark} color={color} height={46} />
    </div>
  );
}

// ------------------------------------------------------------------ rank list
function TopBars({ rows, unit, digits = 0, color, onPick, isAr }) {
  if (rows.length === 0) return <Empty>—</Empty>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.id}>
          <button onClick={() => onPick(r.id)} className="group block w-full text-start">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-[10px] font-bold text-faint">{i + 1}</span>
                <span className="truncate font-medium group-hover:text-brand">{(isAr ? r.name_ar : r.name) || "—"}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums" dir="ltr">{fmt(r.value, digits)}{unit && ` ${unit}`}</span>
            </div>
            <div className="ms-6 mt-1 h-1.5 overflow-hidden rounded-full bg-card">
              <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ rows
function ListRow({ c, isAr, onOpen, tag, right, action }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-0 hover:bg-hover">
      <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 text-start">
        <div className="truncate text-sm font-medium">{custName(c, isAr)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{tag}</div>
      </button>
      <div className="text-end text-xs tabular-nums" dir="ltr">{right}</div>
      {action}
    </div>
  );
}

function BalPair({ c }) {
  return (
    <>
      <div className={`font-semibold ${c.gold_balance > 0 ? "text-danger" : "text-faint"}`}>{fmt(c.gold_balance)} g</div>
      <div className="text-faint">{fmt(c.cash_balance, 0)}</div>
    </>
  );
}

// ------------------------------------------------------------------ attention
function Attention({ d, isAr, t, user, openCustomer, bump, toast }) {
  const A = d.attention;
  const tabs = [
    ["followups", "tabFollowups", d.followups_due, CalendarClock, A.followups],
    ["promises", "tabPromises", A.promises.length, HandCoins, A.promises],
    ["neglected", "tabNeglected", A.neglected_total, TrendingDown, A.neglected],
    ["unassigned", "tabUnassigned", d.unassigned_debtors, UserX, A.unassigned],
  ];
  const first = tabs.find((x) => x[2] > 0)?.[0] || "followups";
  const [tab, setTab] = useState(first);
  const cur = tabs.find((x) => x[0] === tab);
  const take = async (c) => {
    try { await api.patchCustomer(c.id, { assigned_to: user.id }); toast(t("assignedOk")); bump(); }
    catch (e) { toast(e.message, "err"); }
  };
  const go = { followups: "#/myday", promises: "#/myday", neglected: "#/customers?flt=with_balance", unassigned: "#/customers?flt=with_balance&assigned=unassigned" }[tab];

  return (
    <Tile title={t("attentionTitle")} pad={false} className="lg:col-span-7"
      action={<button onClick={() => { window.location.hash = go; }} className="text-xs font-medium text-brand hover:underline">{t("viewAll")} →</button>}>
      <div className="flex gap-1.5 overflow-x-auto px-5 pb-2 pt-3">
        {tabs.map(([id, key, n, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === id ? "bg-brand/10 text-brand" : "text-dim hover:bg-hover"}`}>
            <Icon size={13} /> {t(key)}
            <span className={`rounded-full px-1.5 text-[10px] ${n ? "bg-warn-soft text-warn" : "bg-card text-faint"}`}>{n}</span>
          </button>
        ))}
      </div>
      {cur[4].length === 0 ? <Empty>{t("allClear")} ✨</Empty> : cur[4].map((c) => (
        <ListRow key={`${tab}-${c.id}`} c={c} isAr={isAr} onOpen={openCustomer}
          right={<BalPair c={c} />}
          tag={
            tab === "followups" ? <Badge tone={c.days > 0 ? "danger" : "warn"}>{c.days > 0 ? `${c.days} ${t("daysOverdue")}` : t("dueToday")}</Badge>
            : tab === "promises" ? (<>
                <Badge tone={c.days > 0 ? "danger" : "warn"}>{c.days > 0 ? `${c.days} ${t("daysOverdue")}` : t("dueToday")}</Badge>
                <span className="text-[11px] text-dim" dir="ltr">{[c.p_gold && `${fmt(c.p_gold)} g`, c.p_cash && fmt(c.p_cash, 0), c.p_silver && `${fmt(c.p_silver, 0)} g Ag`].filter(Boolean).join(" · ")}</span>
              </>)
            : tab === "neglected" ? <Badge tone="warn">{c.days === null ? t("neverContacted") : `${c.days} ${t("daysNoContact")}`}</Badge>
            : <Badge>{t("unassigned")}</Badge>
          }
          action={tab === "unassigned" ? <Btn size="sm" variant="primary" onClick={() => take(c)}>{t("takeIt")}</Btn> : null}
        />
      ))}
    </Tile>
  );
}

// ------------------------------------------------------------------ movers
function Movers({ d, isAr, t, openCustomer }) {
  const [m, setM] = useState("gold");
  const unit = m === "gold" ? "g" : "";
  const digits = m === "gold" ? 2 : 0;
  const M = d.movers[m];
  const col = (title, rows, down) => (
    <div className="min-w-0 flex-1">
      <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${down ? "text-ok" : "text-danger"}`}>{down ? "▼" : "▲"} {title}</div>
      {rows.length === 0 ? <div className="py-3 text-xs text-faint">—</div> : rows.map((r) => (
        <button key={r.id} onClick={() => openCustomer(r.id)} className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-start hover:bg-hover">
          <span className="truncate text-xs font-medium">{custName(r, isAr)}</span>
          <span className={`shrink-0 text-xs font-semibold tabular-nums ${down ? "text-ok" : "text-danger"}`} dir="ltr">
            {r.delta > 0 ? "+" : ""}{fmt(r.delta, digits)}{unit && ` ${unit}`}
          </span>
        </button>
      ))}
    </div>
  );
  return (
    <Tile title={t("moversTitle")} className="lg:col-span-5 lg:self-start"
      action={<Pills value={m} onChange={setM} options={[["gold", t("gold")], ["cash", t("cash")]]} />}>
      {!d.prev_day ? <Empty>{t("noHistoryYet")}</Empty> : (
        <div className="flex flex-col gap-4 sm:flex-row">
          {col(t("moversDown"), M.down, true)}
          {col(t("moversUp"), M.up, false)}
        </div>
      )}
    </Tile>
  );
}

// ------------------------------------------------------------------ page
export default function Overview() {
  const { t, isAr } = useI18n();
  const { user, openCustomer, version, bump, toast } = useApp();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [metal, setMetal] = useState("gold");

  const load = useCallback(() => api.overview().then(setD).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load, version]);

  const sync = async () => {
    setSyncing(true);
    try { await api.sync(); bump(); }
    catch (e) { toast(e.message, "err"); }
    finally { setSyncing(false); }
  };

  const greet = useMemo(() => {
    const h = new Date().getHours();
    return t(h < 12 ? "greetMorning" : h < 18 ? "greetAfternoon" : "greetEvening");
  }, [t]);
  const dateStr = new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US", { weekday: "long", month: "long", day: "numeric" });

  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!d) return <Spinner label={t("loading")} />;

  const T = d.totals;
  const ch = d.changes;
  const since = ch ? `${t("vsPrev")} ${ch.since.slice(5)}` : "";
  const trend = d.trend;
  const sp = (k) => trend.map((x) => x[k]);
  const last = d.sync?.last_sync ? d.sync.last_sync.replace("T", " ").slice(0, 16) : "—";
  const unitOf = { gold: "g", cash: "", silver: "g" };
  const maxOut = Math.max(...d.board.map((b) => b.gold_out), 1);
  const pd = d.paid_down, inc = d.increased;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greet}, <span className="text-brand">{user.name}</span></h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-dim">
            {dateStr} · {t("overviewSub")}
            {d.sync?.mock && <Badge tone="warn">{t("demoData")}</Badge>}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-dim">
          {d.sync?.last_error && <span className="text-danger" title={d.sync.last_error}>⚠ {t("syncError")}</span>}
          <span>{t("syncedAt")}: <span dir="ltr">{last}</span></span>
          <Btn size="sm" onClick={sync} loading={syncing}><RefreshCw size={13} /> {syncing ? t("syncing") : t("syncNow")}</Btn>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile accent label={t("goldReceivable")} value={T.gold_receivable} unit={t("grams")} digits={2}
          delta={ch?.gold_receivable ?? null} since={since} spark={sp("gold_receivable")} color="var(--gold)" hint={t("noHistoryYet")}
          sub={`${t("weOweTotal")}: ${fmt(T.gold_payable)} ${t("grams")}`} />
        <KpiTile label={t("cashReceivable")} value={T.cash_receivable} digits={0}
          delta={ch?.cash_receivable ?? null} since={since} spark={sp("cash_receivable")} color="var(--primary)" hint={t("noHistoryYet")}
          sub={`${t("weOweTotal")}: ${fmt(T.cash_payable, 0)}`} />
        <KpiTile label={t("silverReceivable")} value={T.silver_receivable} unit={t("grams")} digits={0}
          delta={ch?.silver_receivable ?? null} since={since} spark={sp("silver_receivable")} color="#7b8794" hint={t("noHistoryYet")}
          sub={`${t("weOweTotal")}: ${fmt(T.silver_payable, 0)} ${t("grams")}`} />
        <KpiTile label={t("debtors")} value={T.debtors} digits={0}
          delta={ch ? ch.debtors : null} since={since} spark={sp("debtors")} color="var(--ok)" hint={t("noHistoryYet")}
          sub={`${d.customers_with_balance} ${t("withBalance")}`} />
      </div>

      {/* trend + paid down */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Tile title={t("trendTitle2")} className="lg:col-span-8"
          action={<Pills value={metal} onChange={setMetal} options={[["gold", t("gold")], ["cash", t("cash")], ["silver", t("silver")]]} />}>
          {trend.length < 2 ? <Empty>{t("noHistoryYet")}</Empty> : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={metal === "gold" ? "var(--gold)" : "var(--primary)"} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={metal === "gold" ? "var(--gold)" : "var(--primary)"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-dim)" }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-dim)" }} width={60} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, 0)} domain={["auto", "auto"]} />
                <Tooltip {...tip} formatter={(v) => [`${fmt(v)} ${unitOf[metal]}`, t(metal)]} />
                <Area isAnimationActive={false} type="monotone" dataKey={`${metal}_receivable`}
                  stroke={metal === "gold" ? "var(--gold)" : "var(--primary)"} strokeWidth={2.2} fill="url(#trendfill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Tile>

        <Tile title={t("paidDownTitle")} className="lg:col-span-4"
          action={d.prev_day ? <span className="text-[11px] text-faint">{t("since")} {d.prev_day.slice(5)}</span> : null}>
          {!d.prev_day ? <Empty>{t("noHistoryYet")}</Empty> : (
            <div className="space-y-4">
              <p className="text-xs text-dim">{t("paidDownHint")}</p>
              {[["gold", t("gold"), 2, "g"], ["cash", t("cash"), 0, ""], ["silver", t("silver"), 0, "g"]].map(([m, label, dg, u]) => {
                const a = pd[m], b = inc[m], tot = a + b;
                return (
                  <div key={m}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="tabular-nums" dir="ltr">
                        <b className="text-ok">▼ {fmt(a, dg)}{u && ` ${u}`}</b>
                        <span className="mx-1.5 text-faint">/</span>
                        <span className="text-danger">▲ {fmt(b, dg)}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-card">
                      {tot > 0 && <div className="bg-ok" style={{ width: `${(a / tot) * 100}%` }} />}
                      {tot > 0 && <div className="bg-danger/70" style={{ width: `${(b / tot) * 100}%` }} />}
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-3 text-[11px] text-faint"><span className="text-ok">■ {t("paidDown")}</span><span className="text-danger">■ {t("newDebt")}</span></div>
            </div>
          )}
        </Tile>
      </div>

      {/* attention + movers */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Attention d={d} isAr={isAr} t={t} user={user} openCustomer={openCustomer} bump={bump} toast={toast} />
        <Movers d={d} isAr={isAr} t={t} openCustomer={openCustomer} />
      </div>

      {/* concentration + top bars */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Tile title={t("concentration")} className="lg:col-span-4">
          {d.gold_share.length === 0 ? <Empty>—</Empty> : (
            <>
              <div className="relative mx-auto h-[170px] w-[170px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={d.gold_share} dataKey="value" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}
                      onClick={(e) => e?.id && openCustomer(e.id)}>
                      {d.gold_share.map((r, i) => <Cell key={r.id + "-" + i} fill={r.id === 0 ? "var(--border)" : GOLD_SHADES[i % GOLD_SHADES.length]} />)}
                    </Pie>
                    <Tooltip {...tip} formatter={(v) => [`${fmt(v)} g`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gold tabular-nums" dir="ltr">{fmt(d.gold_top5_pct, 0)}%</span>
                </div>
              </div>
              <p className="mt-1 text-center text-xs text-dim">{t("top5Share")}</p>
              <ul className="mt-3 space-y-1">
                {d.gold_share.map((r, i) => (
                  <li key={r.id + "-" + i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.id === 0 ? "var(--border)" : GOLD_SHADES[i % GOLD_SHADES.length] }} />
                      <span className="truncate">{r.id === 0 ? t("others") : (isAr ? r.name_ar : r.name)}</span>
                    </span>
                    <span className="tabular-nums text-dim" dir="ltr">{fmt(r.value, 0)} g</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Tile>
        <Tile title={t("topGold")} className="lg:col-span-4">
          <TopBars rows={d.top_gold} unit={t("grams")} digits={2} color="var(--gold)" onPick={openCustomer} isAr={isAr} />
        </Tile>
        <Tile title={t("topCash")} className="lg:col-span-4">
          <TopBars rows={d.top_cash} unit="" color="var(--primary)" onPick={openCustomer} isAr={isAr} />
        </Tile>
      </div>

      {/* board + feed */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Tile title={t("boardTitle")} className="lg:col-span-8 lg:self-start" pad={false}>
          <div className="overflow-x-auto px-5 pb-4 pt-3">
            {d.board.length === 0 ? <Empty>—</Empty> : (
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-dim">
                    <th className="pb-2 text-start whitespace-nowrap ps-3 font-semibold">{t("colCollector")}</th>
                    <th className="pb-2 text-start whitespace-nowrap ps-3 font-semibold">{t("colGoldOut")}</th>
                    <th className="pb-2 text-end whitespace-nowrap ps-3 font-semibold">{t("colCashOut")}</th>
                    <th className="pb-2 text-end whitespace-nowrap ps-3 font-semibold">{t("colF7")}</th>
                    <th className="pb-2 text-end whitespace-nowrap ps-3 font-semibold">{t("colOverdue")}</th>
                    <th className="pb-2 text-end whitespace-nowrap ps-3 font-semibold">{t("colKB")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.board.map((b) => (
                    <tr key={b.id} className="border-t border-line">
                      <td className="py-2.5 pe-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">{b.name.slice(0, 1).toUpperCase()}</span>
                          <span className="leading-tight"><span className="block whitespace-nowrap font-medium">{b.name}</span><span className="block whitespace-nowrap text-[10px] text-faint">{b.debtors} {t("colDebtors")}</span></span>
                        </div>
                      </td>
                      <td className="py-2.5 pe-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-gold" style={{ width: `${(b.gold_out / maxOut) * 100}%` }} /></div>
                          <span className="whitespace-nowrap tabular-nums text-xs text-dim" dir="ltr">{fmt(b.gold_out, 0)} g</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap ps-3 py-2.5 text-end tabular-nums" dir="ltr">{fmt(b.cash_out, 0)}</td>
                                            <td className="ps-3 py-2.5 text-end tabular-nums">{b.followups_7d}</td>
                      <td className={`ps-3 py-2.5 text-end tabular-nums ${b.overdue ? "font-semibold text-warn" : "text-faint"}`}>{b.overdue}</td>
                      <td className="whitespace-nowrap ps-3 py-2.5 text-end tabular-nums" dir="ltr"><span className="text-ok">{b.kept_30d}</span> / <span className="text-danger">{b.broken_30d}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Tile>

        <Tile title={t("recentActivity")} className="lg:col-span-4" pad={false}>
          <div className="px-5 pt-2">
            <ResponsiveContainer width="100%" height={70}>
              <BarChart data={d.activity} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <Tooltip {...tip} labelFormatter={(l) => l} formatter={(v) => [v, t("navCustomers")]} />
                <Bar dataKey="count" fill="var(--primary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {d.feed.length === 0 ? <Empty>{t("noActivity")}</Empty> : d.feed.map((f) => {
            const Icon = KIND_ICON[f.kind] || HelpCircle;
            return (
              <button key={f.id} onClick={() => openCustomer(f.customer_id)}
                className="flex w-full items-center gap-3 border-t border-line px-5 py-2.5 text-start hover:bg-hover">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Icon size={13} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{custName(f, isAr)}</span>
                  <span className="block truncate text-[11px] text-faint">{f.user_name} · {t(KIND_KEY[f.kind])} · <span dir="ltr">{f.created_at.slice(5, 16).replace("T", " ")}</span></span>
                </span>
                <Badge tone={OUT_TONE[f.outcome]}>{t(OUT_KEY[f.outcome])}</Badge>
              </button>
            );
          })}
        </Tile>
      </div>
    </div>
  );
}
