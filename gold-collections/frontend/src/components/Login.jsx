import { useState } from "react";
import { Lock, User } from "lucide-react";
import { api, setToken } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Btn, ErrorBox } from "../ui.jsx";

export default function Login({ onLogin }) {
  const { t, setLang, lang } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api.login(username.trim(), password);
      setToken(r.token);
      onLogin(r.user);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const field = "flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2.5 text-faint focus-within:border-brand";
  const input = "w-full bg-transparent text-sm text-ink outline-none placeholder:text-faint";

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-app p-4"
      style={{ backgroundImage: "radial-gradient(circle at 15% 15%, #5750f114, transparent 40%), radial-gradient(circle at 85% 85%, #b8860b14, transparent 40%)" }}
    >
      <div className="w-full max-w-[380px] rounded-2xl border border-line bg-panel p-8 text-center shadow-pop">
        <div className="mx-auto mb-4 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-white p-2.5 shadow-md">
          <img src="/swag-mark.png" alt="" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-lg font-bold">{t("appName")}</h1>
        <p className="mb-6 mt-1 text-[13px] text-dim">{t("appSub")}</p>
        <form onSubmit={submit} className="flex flex-col gap-3 text-start">
          <div className={field}>
            <User size={16} />
            <input className={input} placeholder={t("username")} value={username} autoFocus autoComplete="username"
              onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className={field}>
            <Lock size={16} />
            <input className={input} type="password" placeholder={t("password")} value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <ErrorBox>{err}</ErrorBox>
          <Btn variant="primary" type="submit" loading={busy} disabled={!username || !password} className="mt-1 py-2.5">
            {busy ? t("signingIn") : t("signIn")}
          </Btn>
        </form>
        <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="mt-5 text-xs text-dim hover:text-ink">
          {t("language")}
        </button>
      </div>
    </div>
  );
}
