import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Banner } from "./ui/banner.jsx";
import { useApp } from "../ui.jsx";

const STALE_HOURS = 24;

// Top-of-page status strip: demo data, last sync failed, or data is stale / never synced.
export default function SyncBanner() {
  const { t } = useI18n();
  const { company, version, bump, toast } = useApp();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.syncStatus().then((s) => live && setSt(s)).catch(() => live && setSt(null));
    return () => { live = false; };
  }, [company, version]);

  if (!st) return null;
  const sync = async () => {
    setBusy(true);
    try { await api.sync(); bump(); } catch (e) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const syncBtn = (
    <button onClick={sync} disabled={busy}
      className="rounded-md border border-current/30 bg-panel/70 px-2.5 py-0.5 text-xs font-semibold text-ink hover:bg-panel disabled:opacity-50">
      {busy ? t("syncing") : t("syncNow")}
    </button>
  );

  if (st.mock) {
    return <Banner id="demo-data" variant="rainbow" message={<span>{t("bnDemo")}</span>} />;
  }
  if (st.last_error) {
    return <Banner id={`err-${company}-${st.last_error.slice(0, 24)}`} variant="danger" message={<><span>{t("bnError")}</span>{syncBtn}</>} />;
  }
  const hours = st.last_sync ? (Date.now() - new Date(st.last_sync).getTime()) / 36e5 : null;
  if (hours === null) {
    return <Banner id={`nosync-${company}`} variant="warning" message={<><span>{t("bnNever")}</span>{syncBtn}</>} />;
  }
  if (hours > STALE_HOURS) {
    return <Banner id={`stale-${company}-${st.last_sync.slice(0, 10)}`} variant="warning"
      message={<><span>{t("bnStale")} ({Math.floor(hours)} {t("hoursAgo")})</span>{syncBtn}</>} />;
  }
  return null;
}
