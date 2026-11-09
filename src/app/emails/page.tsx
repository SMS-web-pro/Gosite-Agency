"use client";

import { useState } from "react";
import {
  Inbox, RefreshCw, Loader2, X, AlertTriangle, Eye, EyeOff,
  MousePointerClick, CreditCard, Trash2, Mail, SendHorizonal, CircleAlert, Activity,
} from "lucide-react";
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
  openedAt: string | null;
  opens: number | null;
  clicks: number | null;
  clickSite: number | null;
  clickPayment: number | null;
  lastClickAt: string | null;
  lastClickUrl: string | null;
  token: string | null;
};

type EmailDetail = EmailRow & { bodyHtml: string | null };

type Stats = {
  total: number;
  sent: number;
  backfilled: number;
  simulated: number;
  failed: number;
  agentReply: number;
  openedUnique: number;
  opensTotal: number;
  clicksTotal: number;
  clickSiteTotal: number;
  clickPaymentTotal: number;
};

const STATUS: Record<string, { label: string; color: string }> = {
  sent: { label: "Envoyé", color: "var(--accent)" },
  backfilled: { label: "Archivé", color: "var(--accent)" },
  simulated: { label: "Simulé", color: "#e5c651" },
  failed: { label: "Échec", color: "#ff5c7a" },
  agent_reply: { label: "Réponse agent", color: "#78b5ff" },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

function StatCard(props: { label: string; value: number | string; sub?: string; color: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }) {
  const Icon = props.icon;
  return (
    <div className="card p-4 flex items-start gap-3" style={{ border: "1px solid var(--border)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: props.color + "14", border: `1px solid ${props.color}33` }}>
        <Icon size={15} style={{ color: props.color }} />
      </div>
      <div className="min-w-0">
        <div className="font-mono font-bold text-[22px] leading-none text-white">{typeof props.value === "number" ? props.value.toLocaleString("fr-FR") : props.value}</div>
        <div className="text-[11px] mt-1.5" style={{ color: "var(--text-dim)" }}>{props.label}</div>
        {props.sub && <div className="text-[10.5px] mt-0.5 font-mono" style={{ color: "var(--text-faint)" }}>{props.sub}</div>}
      </div>
    </div>
  );
}

export default function EmailsPage() {
  const { data, reload, loading } = useApi<{ emails: EmailRow[]; stats: Stats }>("/api/emails", 10000);
  const [open, setOpen] = useState<EmailDetail | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [wiping, setWiping] = useState(false);
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

  const removeOne = async (id: number) => {
    try {
      const r = await fetch(`/api/emails/${id}`, { method: "DELETE" });
      if (r.ok) setToast({ msg: "Email supprimé de l'archive.", kind: "ok" });
      else setToast({ msg: "Suppression impossible — réessaie.", kind: "err" });
      await reload();
    } finally {
      setDeletingId(null);
    }
  };

  const wipeAll = async () => {
    setWiping(true);
    try {
      const r = await fetch("/api/emails", { method: "DELETE" });
      const j = await apiJson<{ deleted?: number }>(r);
      if (r.ok) setToast({ msg: `${j?.deleted ?? 0} email(s) supprimé(s) — archive remise à zéro.`, kind: "ok" });
      else setToast({ msg: "Suppression totale impossible — réessaie.", kind: "err" });
      setConfirmAll(false);
      setOpen(null);
      await reload();
    } finally {
      setWiping(false);
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
  const s = data?.stats;
  const deliverable = (s?.sent ?? 0) + (s?.backfilled ?? 0) + (s?.agentReply ?? 0);
  const openRate = deliverable > 0 ? `${Math.round(((s?.openedUnique ?? 0) / deliverable) * 100)} %` : "—";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[26px] text-white leading-tight">Emails envoyés — suivi en direct</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-dim)" }}>
            Chaque envoi de Saler et de Support : contenu exact, ouvertures (pixel), clics site et clics paiement (redirection trackée).
            <span className="ml-1.5 inline-flex items-center gap-1" style={{ color: "var(--accent)" }}>
              <Activity size={11} /> actualisé toutes les 10 s
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={backfill} disabled={backfilling} className="btn btn-ghost flex items-center gap-2 text-[13px]" style={{ color: "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px" }}>
            {backfilling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Récupérer les anciens
          </button>
          <button
            onClick={() => (confirmAll ? wipeAll() : setConfirmAll(true))}
            disabled={wiping}
            className="btn btn-ghost flex items-center gap-2 text-[13px]"
            style={{ color: confirmAll ? "#ff5c7a" : "var(--text-dim)", border: `1px solid ${confirmAll ? "rgba(255,92,122,.5)" : "var(--border)"}`, borderRadius: 10, padding: "8px 14px", background: confirmAll ? "rgba(255,92,122,.08)" : undefined }}
            onMouseLeave={() => setConfirmAll(false)}
            title="Supprimer TOUTES les archives d'emails"
          >
            {wiping ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {confirmAll ? "Confirmer la suppression totale ?" : "Tout supprimer"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="card p-3 text-[13px] flex items-center justify-between" style={{ borderColor: toast.kind === "ok" ? "rgba(0,229,160,.3)" : "rgba(255,92,122,.4)" }}>
          <span className="flex items-center gap-2" style={{ color: toast.kind === "ok" ? "var(--accent)" : "#ff9db1" }}>
            {toast.kind !== "ok" && <AlertTriangle size={14} />} {toast.msg}
          </span>
          <button onClick={() => setToast(null)} className="text-[11px]" style={{ color: "var(--text-faint)" }}>✕</button>
        </div>
      )}

      {/* Statistiques en direct */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Envoyés (réel)" value={deliverable} sub={`${s.simulated} simulé(s) · ${s.failed} échec(s)`} color="var(--accent)" icon={SendHorizonal} />
          <StatCard label="Échecs d'envoi" value={s.failed} sub={s.total ? `${Math.round((s.failed / s.total) * 100)} % du total` : undefined} color="#ff5c7a" icon={AlertTriangle} />
          <StatCard label="Ouvert (boîtes)" value={s.openedUnique} sub={`taux ${openRate} · ${s.opensTotal} ouverture(s)`} color="#7c9dff" icon={Eye} />
          <StatCard label="Clics site" value={s.clickSiteTotal} sub={`${s.clicksTotal - s.clickPaymentTotal} clic(s) hors paiement au total`} color="#00e5a0" icon={MousePointerClick} />
          <StatCard label="Clics paiement" value={s.clickPaymentTotal} sub="liens Whop suivis" color="#e5c651" icon={CreditCard} />
          <StatCard label="Total emails" value={s.total} sub={`${s.agentReply} réponse(s) agent`} color="#a78bfa" icon={Mail} />
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
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]" style={{ color: "var(--text-dim)" }}>
                  <span className="chip text-[10.5px]" style={{ color: STATUS[open.status]?.color ?? "var(--text-dim)", borderColor: `${STATUS[open.status]?.color ?? "var(--border)"}44` }}>
                    {STATUS[open.status]?.label ?? open.status}
                  </span>
                  {open.openedAt ? (
                    <span className="chip text-[10.5px]" style={{ color: "#7c9dff", borderColor: "#7c9dff44" }}>
                      <Eye size={10} className="inline mr-1" />ouvert {timeAgo(open.openedAt)} · {open.opens} lecture(s)
                    </span>
                  ) : (
                    <span className="chip text-[10.5px]" style={{ color: "var(--text-faint)" }}><EyeOff size={10} className="inline mr-1" />jamais ouvert</span>
                  )}
                  {(open.clickSite ?? 0) > 0 && <span className="chip text-[10.5px]" style={{ color: "var(--accent)", borderColor: "rgba(0,229,160,.3)" }}>site : {open.clickSite} clic(s)</span>}
                  {(open.clickPayment ?? 0) > 0 && <span className="chip text-[10.5px]" style={{ color: "#e5c651", borderColor: "#e5c65144" }}>paiement : {open.clickPayment} clic(s)</span>}
                  {open.lastClickUrl && <span className="text-[10.5px] truncate" style={{ color: "var(--text-faint)" }}>dernier clic : {open.lastClickUrl}</span>}
                  {open.error && <span style={{ color: "#ff9db1" }}>Erreur : {open.error}</span>}
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
                Contenu non archivé pour cet email. Utilisez « Récupérer les anciens » — si Brevo conserve ce messageID, il sera archivé automatiquement.
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
            Chaque envoi apparaît ici avec son suivi : ouvertures, clics site, clics paiement. Les envois antérieurs au tracking sont récupérables via le bouton en haut à droite (sans suivi d'ouverture).
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((e) => {
            const st = STATUS[e.status ?? "sent"] ?? { label: e.status, color: "var(--text-dim)" };
            const tracked = Boolean(e.token);
            return (
              <div key={e.id} className="card p-4 flex items-center gap-3 card-hover" style={{ border: "1px solid var(--border)" }}>
                <button onClick={() => openEmail(e.id)} disabled={openingId === e.id} className="min-w-0 flex-1 text-left no-underline flex items-center gap-3 bg-transparent border-0 p-0 cursor-pointer">
                  <span className="chip text-[10px] shrink-0" style={{ color: st.color, borderColor: `${st.color}44`, minWidth: 74, textAlign: "center" }}>
                    {st.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-white truncate">{e.subject ?? "(sans objet)"}</div>
                    <div className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--text-faint)" }}>
                      {e.businessName ?? "—"} · {e.toEmail}{e.error ? ` · ${e.error}` : ""}
                    </div>
                  </div>
                  <span className="font-mono text-[10.5px] shrink-0 hidden md:inline" style={{ color: "var(--text-faint)" }}>{timeAgo(e.createdAt)}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span title={e.openedAt ? `Ouvert ${timeAgo(e.openedAt)} · ${e.opens} lecture(s)` : "Non ouvert"}
                      className="chip text-[10px]" style={{ color: e.openedAt ? "#7c9dff" : "var(--text-faint)", borderColor: e.openedAt ? "#7c9dff44" : "var(--border)", gap: 3 }}>
                      <Eye size={10} /> {e.opens ?? 0}
                    </span>
                    <span title="Clics sur le lien du site" className="chip text-[10px]" style={{ color: (e.clickSite ?? 0) > 0 ? "var(--accent)" : "var(--text-faint)", borderColor: (e.clickSite ?? 0) > 0 ? "rgba(0,229,160,.3)" : "var(--border)", gap: 3 }}>
                      <MousePointerClick size={10} /> {e.clickSite ?? 0}
                    </span>
                    <span title="Clics sur le lien de paiement Whop" className="chip text-[10px]" style={{ color: (e.clickPayment ?? 0) > 0 ? "#e5c651" : "var(--text-faint)", borderColor: (e.clickPayment ?? 0) > 0 ? "#e5c65144" : "var(--border)", gap: 3 }}>
                      <CreditCard size={10} /> {e.clickPayment ?? 0}
                    </span>
                  </span>
                  {openingId === e.id && <Loader2 size={14} className="animate-spin shrink-0" />}
                </button>
                <button
                  onClick={() => (deletingId === e.id ? removeOne(e.id) : setDeletingId(e.id))}
                  onMouseLeave={() => setDeletingId((cur) => (cur === e.id ? null : cur))}
                  className="p-2 rounded-lg border-0 bg-transparent cursor-pointer shrink-0"
                  title={deletingId === e.id ? "Confirmer la suppression" : "Supprimer cet email de l'archive"}
                >
                  <Trash2 size={14} style={{ color: deletingId === e.id ? "#ff5c7a" : "var(--text-faint)" }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
