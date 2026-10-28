import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { api, setToken } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Spinner } from "@/components/ui/spinner";

// Dark glass sign-in card (modern-stunning-sign-in style), wired to the real login.
export default function Login({ onLogin }) {
  const { t, setLang, lang } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setErr(t("loginMissing")); return; }
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

  const field = "flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 text-white/50 focus-within:ring-2 focus-within:ring-orange-400/70";
  const input = "w-full bg-transparent text-sm text-white outline-none placeholder:text-white/50";

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#121212] p-4">
      <div className="pointer-events-none absolute -left-32 -top-32 size-[420px] rounded-full bg-orange-500/20 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 size-[460px] rounded-full bg-amber-400/10 blur-[120px]" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.07] to-[#121212] p-8 shadow-2xl backdrop-blur-sm">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white p-2.5 shadow-lg shadow-orange-500/20">
          <img src="/swag-mark.png" alt="" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-2xl font-semibold text-white">{t("appName")}</h1>
        <p className="mb-6 mt-1 text-center text-[13px] text-white/55">{t("appSub")}</p>

        <form onSubmit={submit} className="flex w-full flex-col gap-3 text-start">
          <div className={field}>
            <User size={16} />
            <input className={input} placeholder={t("username")} value={username} autoFocus autoComplete="username"
              onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className={field}>
            <Lock size={16} />
            <input className={input} type={show ? "text" : "password"} placeholder={t("password")} value={password} autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="text-white/50 hover:text-white">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {err && <div className="text-sm text-red-400" role="alert">{err}</div>}
          <hr className="border-white/10" />
          <button type="submit" disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-orange-400 bg-gradient-to-t from-orange-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110 disabled:opacity-60">
            {busy && <Spinner variant="circle" size={16} />}
            {busy ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="mt-5 text-xs text-white/55 underline-offset-2 hover:text-white hover:underline">
          {t("language")}
        </button>
      </div>
    </div>
  );
}
