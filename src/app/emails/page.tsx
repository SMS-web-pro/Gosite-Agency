"use client";

import { useState } from "react";
import { Inbox, RefreshCw, Loader2, X, AlertTriangle } from "lucide-react";
import { useApi, apiJson } from "@/components/ui";

type EmailRow = {
  id: number;
  prospectId: number | null;
  toEmail: string;
  subject: string | null;
  status: string;
  error: string | null;
  messageId: string | null;
  createdAt: string;
  businessName: string | null;
};

type EmailDetail = EmailRow & { bodyHtml: string | null };

const STATUS: Record<string, { label: string; color: string }> = {
  sent: { label: "Envoyé", color: "var(--accent)" },
  backfilled: { label: "Archivé", color: "var(--accent)" },
  simulated: { label: "Simulé", color: "#e5c651" },
  failed: { label: "Échec", color: "#ff5c7a" },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

export default function EmailsPage() {
  const { data, reload, loading } = useApi<{ emails: EmailRow[] }>("/api/emails", 20000);
  const [open, setOpen] = useState<EmailDetail | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const openEmail = async (id: number) => {
    setOpeningId(id);
    try {
      const r = await fetch(`/api/emails/${id}`);
      const j = await apiJson<{ email?: EmailDetail; error?: string }>(r);
      if (j?.email) setOpen(j.email);
      else setToast({ msg: j?.error ?? "Email introuvable.", kind: "err" });
    } finally {
      setOpeningId(null);
    }
  };

  const backfill = async () => {
    setBackfilling(true);
    try {
      const r = await fetch("/api/emails/backfill", { method: "POST" });
      const j = await apiJson<{ fetched?: number; archived?: number; skipped?: number; missing?: number; error?: string }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — réessaie.", kind: "err" }); return; }
      if (j.error) setToast({ msg: `${j.error} — récupérés: ${j.archived ?? 0}, ignorés: ${j.skipped ?? 0}, introuvables: ${j.missing ?? 0}.`, kind: "err" });
      else setToast({ msg: `Rétro-complétion : ${j.archived ?? 0} archivé(s), ${j.skipped ?? 0} sans contenu, ${j.missing ?? 0} introuvable(s).`, kind: "ok" });
      await reload();
    } finally {
      setBackfilling(false);
    }
  };

  const list = data?.emails ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[26px] text-white leading-tight">Emails envoyés</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
            Archive de tout ce que Saler envoie : objet et contenu exact, tel que reçu par le prospect.
          </p>
        </div>
        <button onClick={backfill} disabled={backfilling} className="btn btn-ghost flex items-center gap-2 text-[13px]" style={{ color: "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px" }}>
          {backfilling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Récupérer les anciens emails
        </button>
      </div>

      {toast && (
        <div className="card p-3 text-[13px] flex items-center justify-between" style={{ borderColor: toast.kind === "ok" ? "rgba(0,229,160,.3)" : "rgba(255,92,122,.4)" }}>
          <span className="flex items-center gap-2" style={{ color: toast.kind === "ok" ? "var(--accent)" : "#ff9db1" }}>
            {toast.kind !== "ok" && <AlertTriangle size={14} />} {toast.msg}
          </span>
          <button onClick={() => setToast(null)} className="text-[11px]" style={{ color: "var(--text-faint)" }}>✕</button>
        </div>
      )}

      {/* Lecture d'un email */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4" style={{ background: "rgba(4,6,10,.72)", backdropFilter: "blur(6px)" }} onClick={() => setOpen(null)}>
          <div className="card w-full max-w-[720px] flex flex-col" style={{ background: "var(--bg, #0b0e14)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 p-5 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0">
                <div className="font-semibold text-[15px] text-white break-words">{open.subject ?? "(sans objet)"}</div>
                <div className="text-[12px] mt-1.5" style={{ color: "var(--text-dim)" }}>
                  À <span style={{ color: "var(--text)" }}>{open.toEmail}</span>
                  {open.businessName ? ` · ${open.businessName}` : ""} · {timeAgo(open.createdAt)}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="chip text-[10.5px]" style={{ color: STATUS[open.status]?.color ?? "var(--text-dim)", borderColor: `${STATUS[open.status]?.color ?? "var(--border)"}44` }}>
                    {STATUS[open.status]?.label ?? open.status}
                  </span>
                  {open.error && <span className="text-[11.5px]" style={{ color: "#ff9db1" }}>Erreur : {open.error}</span>}
                </div>
              </div>
              <button onClick={() => setOpen(null)} className="p-1.5 rounded-lg hover:bg-white/5" title="Fermer">
                <X size={16} style={{ color: "var(--text-dim)" }} />
              </button>
            </div>
            {open.bodyHtml ? (
              <iframe
                sandbox=""
                srcDoc={open.bodyHtml}
                title={open.subject ?? "Email"}
                style={{ width: "100%", minHeight: 480, background: "#fff", border: 0, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }}
              />
            ) : (
              <div className="p-6 text-[13px]" style={{ color: "var(--text-faint)" }}>
                Contenu non archivé pour cet email. Utilisez « Récupérer les anciens emails » — si Brevo conserve ce messageID, il sera archivé automatiquement.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste */}
      {loading && list.length === 0 ? (
        <div className="text-[13px] py-10 text-center" style={{ color: "var(--text-faint)" }}>Chargement des emails…</div>
      ) : list.length === 0 ? (
        <div className="card p-10 flex flex-col items-center gap-3 text-center">
          <Inbox size={28} style={{ color: "var(--text-faint)" }} />
          <div className="text-[14px]" style={{ color: "var(--text-dim)" }}>Aucun email archivé pour le moment.</div>
          <div className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
            Chaque offre envoyée via Saler apparaît ici. Les envois antérieurs sont récupérables via le bouton en haut à droite.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((e) => {
            const st = STATUS[e.status ?? "sent"] ?? { label: e.status, color: "var(--text-dim)" };
            return (
              <button key={e.id} onClick={() => openEmail(e.id)} disabled={openingId === e.id}
                className="card p-4 flex items-center gap-4 text-left no-underline card-hover"
                style={{ border: "1px solid var(--border)" }}>
                <span className="chip text-[10px] shrink-0" style={{ color: st.color, borderColor: `${st.color}44`, minWidth: 74, textAlign: "center" }}>
                  {st.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium text-white truncate">{e.subject ?? "(sans objet)"}</div>
                  <div className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--text-faint)" }}>
                    {e.businessName ?? "—"} · {e.toEmail}{e.error ? ` · ${e.error}` : ""}
                  </div>
                </div>
                <span className="font-mono text-[10.5px] shrink-0" style={{ color: "var(--text-faint)" }}>{timeAgo(e.createdAt)}</span>
                {openingId === e.id && <Loader2 size={14} className="animate-spin shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
