import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, FileText, MapPin, MessageCircle, Phone, StickyNote, Trash2, X, XCircle, HelpCircle } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import {
  Bal, Badge, Btn, DeltaMini, ErrorBox, Field, Pills, Spinner, StatusBadge, addDays, CustName, fmt, fmtDate, inputCls, todayISO, useApp,
} from "../ui.jsx";

const KIND_ICON = { call: Phone, whatsapp: MessageCircle, visit: MapPin, note: StickyNote, other: HelpCircle };
const KINDS = [["call", "kCall"], ["whatsapp", "kWhatsapp"], ["visit", "kVisit"], ["note", "kNote"], ["other", "kOther"]];
const OUTCOMES = [["reached", "oReached"], ["no_answer", "oNoAnswer"], ["promised", "oPromised"], ["refused", "oRefused"], ["paid", "oPaid"], ["other", "oOther"]];
const OUT_TONE = { reached: "ok", paid: "ok", promised: "gold", no_answer: "warn", refused: "danger", other: "neutral" };
const P_TONE = { pending: "gold", kept: "ok", broken: "danger" };
const P_KEY = { pending: "pPending", kept: "pKept", broken: "pBroken" };

function BalanceCard({ title, unit, digits, debit, credit, balance, delta }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-line bg-card p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-dim">{title}</div>
      <Bal value={balance} unit={unit} digits={digits} className="mt-1 block text-lg" />
      <DeltaMini value={delta} balance={balance} digits={digits} />
      <div className="mt-1.5 space-y-0.5 text-[11px] text-faint" dir="ltr">
        <div>{t("debit")}: {fmt(debit, digits)}</div>
        <div>{t("credit")}: {fmt(credit, digits)}</div>
      </div>
    </div>
  );
}

export default function CustomerDrawer({ id, onClose }) {
  const { t, isAr } = useI18n();
  const { user, collectors, bump, toast, openStatement } = useApp();
  const [c, setC] = useState(null);
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const blank = () => ({ kind: "call", outcome: "reached", note: "", next: "", promise: false,
    pdate: addDays(todayISO(), 7), pgold: "", pcash: "", psilver: "" });
  const [form, setForm] = useState(blank());
  const [formErr, setFormErr] = useState("");
  const [hm, setHm] = useState("gold");
  const isAdmin = user.role === "admin";

  const load = useCallback(() =>
    api.customer(id).then((d) => { setC(d); setNotes(d.notes || ""); }).catch((e) => setErr(e.message)), [id]);
  useEffect(() => { setC(null); load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = async (body) => {
    try { await api.patchCustomer(id, body); await load(); bump(); toast(t("saved")); }
    catch (e) { toast(e.message, "err"); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormErr("");
    const num = (v) => (v === "" ? null : Number(v));
    const body = { kind: form.kind, outcome: form.outcome, note: form.note, next_followup_date: form.next || null };
    if (form.promise) {
      const amounts = { promise_gold: num(form.pgold), promise_cash: num(form.pcash), promise_silver: num(form.psilver) };
      if (!form.pdate || !Object.values(amounts).some((v) => v > 0)) { setFormErr(t("promiseNeedsAmount")); return; }
      Object.assign(body, { promise_date: form.pdate, ...amounts });
    }
    setBusy(true);
    try {
      await api.addFollowup(id, body);
      setForm(blank());
      await load();
      bump();
      toast(t("saved"));
    } catch (ex) { setFormErr(ex.message); }
    finally { setBusy(false); }
  };

  const setPromise = async (fid, status) => {
    try { await api.patchFollowup(fid, { promise_status: status }); await load(); bump(); }
    catch (e) { toast(e.message, "err"); }
  };
  const del = async (fid) => {
    if (!window.confirm(t("confirmDelete"))) return;
    try { await api.deleteFollowup(fid); await load(); bump(); }
    catch (e) { toast(e.message, "err"); }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const mine = c && c.assigned_to === user.id;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/45" onMouseDown={onClose}>
      <div className="drawer-anim flex h-full w-full max-w-[560px] flex-col border-s border-line bg-panel shadow-pop" onMouseDown={(e) => e.stopPropagation()}>
        {!c ? (
          <div className="p-6">{err ? <ErrorBox>{err}</ErrorBox> : <Spinner label={t("loading")} />}</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-line p-5">
              <div className="min-w-0">
                <h2 className="text-lg font-bold"><CustName c={c} isAr={isAr} /></h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-dim">
                  <span dir="ltr">{c.code}</span>
                  <StatusBadge status={c.status} />
                  {c.promise && <Badge tone={c.promise.overdue ? "danger" : "gold"}>{t("promise")}: {fmtDate(c.promise.date)}</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Btn size="sm" onClick={() => openStatement(id)}><FileText size={14} /> {t("statementBtn")}</Btn>
                <button onClick={onClose} className="rounded-lg p-1.5 text-dim hover:bg-hover hover:text-ink" aria-label={t("close")}><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* balances */}
              <section>
                <h3 className="mb-2 text-sm font-semibold">{t("balances")}</h3>
                <div className="grid grid-cols-3 gap-2.5">
                  <BalanceCard title={t("gold")} unit={t("grams")} digits={2} debit={c.gold_debit} credit={c.gold_credit} balance={c.gold_balance} delta={c.delta?.gold} />
                  <BalanceCard title={t("cash")} unit="" digits={0} debit={c.cash_debit} credit={c.cash_credit} balance={c.cash_balance} delta={c.delta?.cash} />
                  <BalanceCard title={t("silver")} unit={t("grams")} digits={0} debit={c.silver_debit} credit={c.silver_credit} balance={c.silver_balance} delta={c.delta?.silver} />
                </div>
              </section>

              {/* history */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{t("historyTitle")}</h3>
                  <Pills value={hm} onChange={setHm} options={[["gold", t("gold")], ["cash", t("cash")], ["silver", t("silver")]]} />
                </div>
                {c.history.length < 2 ? <p className="rounded-lg bg-card p-3 text-xs text-faint">{t("historyBuilds")}</p> : (
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={c.history} margin={{ left: 0, right: 6, top: 6 }}>
                      <defs>
                        <linearGradient id="hfill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={hm === "gold" ? "var(--gold)" : "var(--primary)"} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={hm === "gold" ? "var(--gold)" : "var(--primary)"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-dim)" }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-dim)" }} width={52} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v, 0)} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--text)" }}
                        formatter={(v) => [fmt(v), t(hm)]} />
                      <Area isAnimationActive={false} type="monotone" dataKey={hm} stroke={hm === "gold" ? "var(--gold)" : "var(--primary)"} strokeWidth={2} fill="url(#hfill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </section>

              {/* ownership */}
              <section className="grid grid-cols-2 gap-3">
                <Field label={t("assignedTo")}>
                  {isAdmin ? (
                    <select className={inputCls} value={c.assigned_to ?? ""} onChange={(e) => patch({ assigned_to: e.target.value === "" ? null : Number(e.target.value) })}>
                      <option value="">{t("unassigned")}</option>
                      {collectors.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-ink">
                      <span className="truncate">{c.assigned_name || t("unassigned")}</span>
                      {mine ? <Btn size="sm" onClick={() => patch({ assigned_to: null })}>{t("unassign")}</Btn>
                        : !c.assigned_to && <Btn size="sm" variant="primary" onClick={() => patch({ assigned_to: user.id })}>{t("takeIt")}</Btn>}
                    </div>
                  )}
                </Field>
                <Field label={t("status")}>
                  <select className={inputCls} value={c.status} onChange={(e) => patch({ status: e.target.value })}>
                    <option value="active">{t("stActive")}</option>
                    <option value="hold">{t("stHold")}</option>
                    <option value="legal">{t("stLegal")}</option>
                  </select>
                </Field>
              </section>

              {/* notes */}
              <section>
                <Field label={t("notes")}>
                  <textarea className={`${inputCls} min-h-[70px]`} value={notes} placeholder={t("notesHint")} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                {notes !== (c.notes || "") && (
                  <div className="mt-2 flex justify-end"><Btn size="sm" variant="primary" onClick={() => patch({ notes })}>{t("save")}</Btn></div>
                )}
              </section>

              {/* log follow-up */}
              <section className="rounded-xl border border-line bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">{t("logFollowup")}</h3>
                <form onSubmit={submit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("kind")}>
                      <select className={inputCls} value={form.kind} onChange={set("kind")}>
                        {KINDS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
                      </select>
                    </Field>
                    <Field label={t("outcome")}>
                      <select className={inputCls} value={form.outcome} onChange={set("outcome")}>
                        {OUTCOMES.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label={t("note")}>
                    <textarea className={`${inputCls} min-h-[56px]`} value={form.note} onChange={set("note")} />
                  </Field>
                  <Field label={t("nextFollowupDate")}>
                    <input type="date" className={inputCls} value={form.next} onChange={set("next")} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.promise} onChange={set("promise")} /> {t("addPromise")}
                  </label>
                  {form.promise && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg bg-gold-soft p-3">
                      <Field label={t("promiseDate")} className="col-span-2">
                        <input type="date" className={inputCls} value={form.pdate} onChange={set("pdate")} />
                      </Field>
                      <Field label={t("promiseGold")}><input type="number" min="0" step="any" className={inputCls} value={form.pgold} onChange={set("pgold")} /></Field>
                      <Field label={t("promiseCash")}><input type="number" min="0" step="any" className={inputCls} value={form.pcash} onChange={set("pcash")} /></Field>
                      <Field label={t("promiseSilver")}><input type="number" min="0" step="any" className={inputCls} value={form.psilver} onChange={set("psilver")} /></Field>
                    </div>
                  )}
                  <ErrorBox>{formErr}</ErrorBox>
                  <div className="flex justify-end"><Btn variant="primary" type="submit" loading={busy}>{t("save")}</Btn></div>
                </form>
              </section>

              {/* timeline */}
              <section>
                <h3 className="mb-3 text-sm font-semibold">{t("timeline")}</h3>
                {c.followups.length === 0 ? <p className="text-sm text-faint">{t("noHistory")}</p> : (
                  <ol className="space-y-3">
                    {c.followups.map((f) => {
                      const Icon = KIND_ICON[f.kind] || HelpCircle;
                      const kindLabel = KINDS.find(([v]) => v === f.kind)?.[1];
                      const outLabel = OUTCOMES.find(([v]) => v === f.outcome)?.[1];
                      const canDel = isAdmin || f.user_id === user.id;
                      return (
                        <li key={f.id} className="rounded-xl border border-line p-3">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Icon size={15} /></div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <b>{t(kindLabel)}</b>
                                <Badge tone={OUT_TONE[f.outcome]}>{t(outLabel)}</Badge>
                              </div>
                              <div className="text-[11px] text-faint">{t("by")} {f.user_name} · <span dir="ltr">{f.created_at.replace("T", " ").slice(0, 16)}</span></div>
                              {f.note && <p className="mt-1.5 whitespace-pre-wrap text-sm">{f.note}</p>}
                              {f.next_followup_date && <div className="mt-1.5 text-xs text-dim">{t("nextFollowup")}: <span dir="ltr">{f.next_followup_date}</span></div>}
                              {f.promise_date && (
                                <div className="mt-2 rounded-lg bg-gold-soft p-2.5 text-xs">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <b>{t("promise")}: <span dir="ltr">{f.promise_date}</span></b>
                                    <Badge tone={P_TONE[f.promise_status]}>{t(P_KEY[f.promise_status])}</Badge>
                                  </div>
                                  <div className="mt-1 text-dim" dir="ltr">
                                    {[f.promise_gold && `${fmt(f.promise_gold)} g gold`, f.promise_cash && `${fmt(f.promise_cash, 0)} cash`, f.promise_silver && `${fmt(f.promise_silver, 0)} g silver`].filter(Boolean).join("  ·  ")}
                                  </div>
                                  {f.promise_status === "pending" && (
                                    <div className="mt-2 flex gap-2">
                                      <Btn size="sm" variant="ok" onClick={() => setPromise(f.id, "kept")}><Check size={12} /> {t("markKept")}</Btn>
                                      <Btn size="sm" variant="danger" onClick={() => setPromise(f.id, "broken")}><XCircle size={12} /> {t("markBroken")}</Btn>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {canDel && (
                              <button onClick={() => del(f.id)} className="text-faint hover:text-danger" aria-label={t("delete")}><Trash2 size={15} /></button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
