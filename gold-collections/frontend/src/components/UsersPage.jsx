import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Badge, Btn, Card, ErrorBox, Field, Modal, Spinner, inputCls, useApp } from "../ui.jsx";

function NewUser({ onClose, onDone }) {
  const { t } = useI18n();
  const [f, setF] = useState({ username: "", name: "", password: "", role: "collector" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try { await api.createUser(f); onDone(); }
    catch (ex) { setErr(ex.message); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={t("newUser")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t("fullName")}><input className={inputCls} value={f.name} onChange={set("name")} /></Field>
        <Field label={t("username")}><input className={inputCls} value={f.username} onChange={set("username")} autoComplete="off" /></Field>
        <Field label={t("newPassword")}><input type="password" className={inputCls} value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
        <Field label={t("role")}>
          <select className={inputCls} value={f.role} onChange={set("role")}>
            <option value="collector">{t("rCollector")}</option>
            <option value="admin">{t("rAdmin")}</option>
          </select>
        </Field>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <Btn type="button" onClick={onClose}>{t("cancel")}</Btn>
          <Btn variant="primary" type="submit" loading={busy} disabled={!f.name || f.username.length < 3 || f.password.length < 8}>{t("createUser")}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function ResetPw({ u, onClose, onDone }) {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try { await api.patchUser(u.id, { password: pw }); onDone(); }
    catch (ex) { setErr(ex.message); }
  };
  return (
    <Modal title={`${t("resetPassword")} — ${u.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label={t("newPassword")}><input type="password" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
        <ErrorBox>{err}</ErrorBox>
        <div className="flex justify-end gap-2">
          <Btn type="button" onClick={onClose}>{t("cancel")}</Btn>
          <Btn variant="primary" type="submit" disabled={pw.length < 8}>{t("save")}</Btn>
        </div>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { t } = useI18n();
  const { user, toast } = useApp();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [reset, setReset] = useState(null);

  const load = useCallback(() => api.users().then(setRows).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const patch = async (u, body) => {
    try { await api.patchUser(u.id, body); toast(t("saved")); load(); }
    catch (e) { toast(e.message, "err"); }
  };

  if (err) return <ErrorBox>{err}</ErrorBox>;
  if (!rows) return <Spinner label={t("loading")} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t("usersTitle")}</h1>
          <p className="text-xs text-dim">{t("rolesHint")}</p>
        </div>
        <Btn variant="primary" onClick={() => setAdding(true)}><Plus size={14} /> {t("newUser")}</Btn>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line bg-card text-[11px] uppercase tracking-wide text-dim">
            <tr>
              <th className="px-4 py-2.5 text-start">{t("fullName")}</th>
              <th className="px-4 py-2.5 text-start">{t("username")}</th>
              <th className="px-4 py-2.5 text-start">{t("role")}</th>
              <th className="px-4 py-2.5 text-start">{t("status")}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const me = u.id === user.id;
              return (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">{u.name}{me && <span className="ms-2 text-xs text-faint">(you)</span>}</td>
                  <td className="px-4 py-3 text-dim" dir="ltr">{u.username}</td>
                  <td className="px-4 py-3">
                    <select className={`${inputCls} !w-auto !py-1`} value={u.role} disabled={me}
                      onChange={(e) => patch(u, { role: e.target.value })}>
                      <option value="collector">{t("rCollector")}</option>
                      <option value="admin">{t("rAdmin")}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3"><Badge tone={u.active ? "ok" : "neutral"}>{u.active ? t("active") : t("disabled")}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Btn size="sm" onClick={() => setReset(u)}><KeyRound size={12} /> {t("resetPassword")}</Btn>
                      {!me && (
                        <Btn size="sm" variant={u.active ? "danger" : "ok"} onClick={() => patch(u, { active: !u.active })}>
                          {u.active ? t("disable") : t("enable")}
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {adding && <NewUser onClose={() => setAdding(false)} onDone={() => { setAdding(false); toast(t("saved")); load(); }} />}
      {reset && <ResetPw u={reset} onClose={() => setReset(null)} onDone={() => { setReset(null); toast(t("saved")); }} />}
    </div>
  );
}
