import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n.jsx";
import { Btn, ErrorBox, Modal, useApp } from "../ui.jsx";

export default function ImportReportModal({ onClose }) {
  const { t } = useI18n();
  const { company, companies, bump, toast } = useApp();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [needForce, setNeedForce] = useState(false);
  const [res, setRes] = useState(null);
  const cname = companies.find((c) => c.key === company)?.name || company;

  const run = async (force = false) => {
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.importReport(file, force);
      setRes(r);
      setNeedForce(false);
      bump();
      toast(t("importDone"));
    } catch (e) {
      setErr(e.message);
      setNeedForce(/nahi lagti/.test(e.message));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`${t("importTitle")} — ${cname}`} onClose={onClose} width="max-w-lg">
      {res ? (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-ok-soft p-3 text-ok">
            <div className="font-semibold">✓ {t("importDone")}</div>
            <div className="mt-1"><b>{res.matched}</b> {t("importMatched")} · <b>{res.with_mobile}</b> {t("importWithMobile")}</div>
          </div>
          {res.report_date && <div className="text-xs text-dim">{t("importReportDate")}: <span dir="ltr">{res.report_date}</span></div>}
          {res.unmatched_total > 0 && (
            <div className="rounded-xl border border-line p-3 text-xs text-dim">
              <b>{res.unmatched_total}</b> {t("importUnmatched")}
              <ul className="mt-1.5 space-y-0.5" dir="auto">
                {res.unmatched.map((u) => <li key={u.code} className="truncate"><span dir="ltr">{u.code}</span> · {u.name}</li>)}
              </ul>
            </div>
          )}
          <div className="flex justify-end"><Btn variant="primary" onClick={onClose}>{t("close")}</Btn></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-dim">{t("importHint")}</p>
          <button type="button" onClick={() => input.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-6 text-sm text-dim hover:border-brand hover:text-brand">
            <FileSpreadsheet size={20} />
            {file ? <span dir="ltr" className="font-medium text-ink">{file.name}</span> : t("importChoose")}
          </button>
          <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setErr(""); setNeedForce(false); }} />
          <ErrorBox>{err}</ErrorBox>
          <div className="flex justify-end gap-2">
            <Btn onClick={onClose}>{t("cancel")}</Btn>
            {needForce && <Btn variant="danger" onClick={() => run(true)} loading={busy}>{t("importForce")}</Btn>}
            <Btn variant="primary" onClick={() => run(false)} loading={busy} disabled={!file}><Upload size={14} /> {busy ? t("importUploading") : t("importReport")}</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
