import { useCallback, useEffect, useState } from "react";
import { Check, CalendarClock, HandCoins, UserX, XCircle } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Bal, Badge, Btn, Card, Empty, ErrorBox, Spinner, CustName, fmt, useApp } from "../ui.jsx";

function DueTag({ days }) {
  const { t } = useI18n();
  if (days > 0) return <Badge tone="danger">{days} {t("daysOverdue")}</Badge>;
  return <Badge tone="warn">{t("dueToday")}</Badge>;
}

function Row({ c, extra, onOpen }) {
  const { t, isAr } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-hover">
      <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 text-start">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 font-medium"><CustName c={c} isAr={isAr} compact /></span>
          {c.days_overdue !== undefined && <DueTag days={c.days_overdue} />}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-faint">
          <span dir="ltr">{c.code}</span>
          {c.assigned_name && <span>{c.assigned_name}</span>}
        </div>
      </button>
      <div className="flex items-center gap-4 text-sm">
        <Bal value={c.gold_balance} unit={t("grams")} />
        <Bal value={c.cash_balance} digits={0} className="hidden sm:inline" />
      </div>
      {extra}
    </div>
  );
}

export default function MyDay() {
  const { t } = useI18n();
  const { user, openCustomer, version, bump, toast } = useApp();
  const isAdmin = user.role === "admin";
  const [scope, setScope] = useState(isAdmin ? "all" : "mine");
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => api.myday(scope).then(setD).catch((e) => setErr(e.message)), [scope]);
  useEffect(() => { load(); }, [load, version]);

  const resolve = async (promise, status) => {
    try { await api.patchFollowup(promise.id, { promise_status: status }); bump(); }
    catch (e) { toast(e.message, "err"); }
  };
  const take = async (c) => {
    try { await api.patchCustomer(c.id, { assigned_to: user.id }); toast(t("assignedOk")); bump(); }
    catch (e) { toast(e.message, "err"); }
  };

  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!d) return <Spinner label={t("loading")} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("myDayTitle")}</h1>
        <div className="inline-flex rounded-lg bg-card p-1 text-xs font-semibold">
          {["mine", "all"].map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={`rounded-md px-3 py-1.5 ${scope === s ? "bg-panel text-ink shadow-card" : "text-dim"}`}>
              {t(s === "mine" ? "scopeMine" : "scopeAll")}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
          <CalendarClock size={16} className="text-warn" /> {t("followupsToday")}
          <Badge tone={d.followups.length ? "warn" : "neutral"}>{d.followups.length}</Badge>
        </div>
        {d.followups.length === 0 ? <Empty>{t("nothingDue")}</Empty> :
          d.followups.map((c) => <Row key={c.id} c={c} onOpen={openCustomer} />)}
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
          <HandCoins size={16} className="text-gold" /> {t("promisesToday")}
          <Badge tone={d.promises.length ? "gold" : "neutral"}>{d.promises.length}</Badge>
        </div>
        {d.promises.length === 0 ? <Empty>{t("nothingDue")}</Empty> :
          d.promises.map((c) => (
            <Row key={c.id} c={c} onOpen={openCustomer} extra={
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <span className="text-xs text-dim" dir="ltr">
                  {[c.promise.gold && `${fmt(c.promise.gold)} g`, c.promise.cash && fmt(c.promise.cash, 0), c.promise.silver && `${fmt(c.promise.silver, 0)} g Ag`].filter(Boolean).join(" · ")}
                </span>
                <Btn size="sm" variant="ok" onClick={() => resolve(c.promise, "kept")}><Check size={12} /> {t("pKept")}</Btn>
                <Btn size="sm" variant="danger" onClick={() => resolve(c.promise, "broken")}><XCircle size={12} /> {t("pBroken")}</Btn>
              </div>
            } />
          ))}
      </Card>

      {d.unassigned_debtors.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-sm font-semibold">
            <UserX size={16} className="text-dim" /> {t("unassignedTitle")}
            <Badge>{d.unassigned_debtors.length}</Badge>
          </div>
          {d.unassigned_debtors.map((c) => (
            <Row key={c.id} c={c} onOpen={openCustomer}
              extra={<Btn size="sm" variant="primary" onClick={() => take(c)}>{t("takeIt")}</Btn>} />
          ))}
        </Card>
      )}
    </div>
  );
}
