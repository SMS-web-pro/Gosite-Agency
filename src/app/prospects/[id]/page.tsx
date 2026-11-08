"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Zap, ExternalLink, Monitor, Smartphone, Copy, Check,
  MapPin, Phone, Mail, Clock, Star, Globe, Rocket, Send, CreditCard, LifeBuoy,
  BadgeCheck, MailCheck, ClipboardList, Code2, CircleDollarSign, StickyNote,
} from "lucide-react";
import { useApi, Toast, Stars, STAGE_LABELS, STAGE_COLORS, stageChipStyle, apiJson } from "@/components/ui";

type EmailArchiveRow = {
  id: number; prospectId: number | null; toEmail: string; subject: string | null;
  status: string; error: string | null; createdAt: string; businessName: string | null;
};

type ProspectDetail = {
  id: number; businessName: string; businessType: string; tagline: string | null; description: string | null;
  phone: string | null; email: string | null; emailStatus: string; emailDetail: string | null;
  address: string | null; city: string | null; zip: string | null; country: string | null;
  rating: string | null; reviewCount: number | null; hasWebsite: boolean; websiteUrl: string | null;
  mapsLink: string | null; lat: string | null; lng: string | null; stage: string; rejectReason: string | null;
  clientData: Record<string, string> | null; hasSite: boolean; siteSize: number; siteSlug: string | null;
  deployedUrl: string | null; deployStatus: string; paymentUrl: string | null; paymentStatus: string;
  domainUrl: string | null; source: string; searchQuery: string | null; createdAt: string;
  salesEmailId: string | null; contactedAt: string | null;
  aiScore: number | null; aiInsight: string | null;
};

const TIMELINE = [
  { stage: "discovered", icon: MapPin, label: "Découvert", agent: "Prospector" },
  { stage: "validated", icon: BadgeCheck, label: "Qualifié", agent: "Validator" },
  { stage: "email_verified", icon: MailCheck, label: "Email vérifié", agent: "Emailor" },
  { stage: "mapped", icon: ClipboardList, label: "Fiche client", agent: "Mapper" },
  { stage: "site_built", icon: Code2, label: "Site généré", agent: "Coder" },
  { stage: "deployed", icon: Rocket, label: "Déployé", agent: "Deployer" },
  { stage: "contacted", icon: Send, label: "Offre envoyée", agent: "Saler" },
  { stage: "paid", icon: CircleDollarSign, label: "Payé", agent: "Paymer" },
  { stage: "domain_linked", icon: Globe, label: "Domaine lié", agent: "Domainner" },
];

const SHEET_FIELDS = [
  "BUSINESS_NAME", "BUSINESS_TYPE", "TAGLINE", "DESCRIPTION", "PHONE", "EMAIL", "ADDRESS", "CITY", "ZIP", "COUNTRY",
  "CURRENCY", "GOOGLE_RATING", "REVIEW_COUNT", "HOURS_WEEKDAY", "HOURS_SAT", "HOURS_SUN", "MAPS_LINK", "LAT", "LNG",
  "LANG", "LANG_DIR", "LOCALE", "SCHEMA_TYPE", "PRIMARY_COLOR", "ACCENT_COLOR", "NEUTRAL_BG", "STYLE", "HERO_IMAGE_URL",
];

export default function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, reload } = useApi<{ prospect: ProspectDetail }>(`/api/prospects/${id}`, 5000);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<{ id: number; author: string; body: string; createdAt: string }[]>([]);

  const mails = useApi<{ emails: EmailArchiveRow[] }>(`/api/emails?prospectId=${id}`, 15000);
  const [openMail, setOpenMail] = useState<{ id: number; bodyHtml: string | null; subject: string | null } | null>(null);

  const openMailDetail = async (mailId: number) => {
    if (openMail?.id === mailId) { setOpenMail(null); return; }
    setOpenMail({ id: mailId, bodyHtml: null, subject: null });
    const r = await fetch(`/api/emails/${mailId}`);
    const j = await apiJson<{ email?: { bodyHtml: string | null; subject: string | null }; error?: string }>(r);
    if (j?.email) setOpenMail({ id: mailId, bodyHtml: j.email.bodyHtml, subject: j.email.subject });
  };

  const backfillMails = async () => {
    setBusy("backfill");
    try {
      const r = await fetch("/api/emails/backfill", { method: "POST" });
      const j = await apiJson<{ archived?: number; skipped?: number; missing?: number; error?: string }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — réessaie.", kind: "err" }); return; }
      if (j.error) setToast({ msg: `${j.error}`, kind: "err" });
      else setToast({ msg: `Récupération Brevo : ${j.archived ?? 0} archivé(s), ${j.missing ?? 0} introuvable(s).`, kind: "ok" });
      await mails.reload();
      await reload();
    } finally { setBusy(null); }
  };

  const p = data?.prospect;

  const loadNotes = async () => {
    const r = await fetch(`/api/prospects/${id}/notes`);
    const j = await apiJson<{ notes?: { id: number; author: string; body: string; createdAt: string }[] }>(r);
    if (j?.notes) setNotes(j.notes);
  };
  useEffect(() => { loadNotes(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const addNote = async () => {
    if (!noteText.trim()) return;
    setBusy("note");
    try {
      await fetch(`/api/prospects/${id}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteText, author: "RIO" }),
      });
      setNoteText("");
      await loadNotes();
      setToast({ msg: "Note enregistrée.", kind: "ok" });
    } finally { setBusy(null); }
  };

  const act = async (action: string, label: string) => {
    setBusy(action);
    try {
      const r = await fetch(`/api/prospects/${id}/advance`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const j = await apiJson<{ ok?: boolean; url?: string; engine?: string; reason?: string; error?: string }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — réessaie.", kind: "err" }); return; }
        if (j.ok) setToast({ msg: `${label} : succès.${j.url ? ` → ${j.url}` : ""}${j.engine ? ` (moteur ${j.engine === "gemini" ? "Gemini 3.8" : j.engine === "llm" ? "LLM omniroute" : "gabarit interne"})` : ""}`, kind: "ok" });
      else setToast({ msg: j.reason ?? j.error ?? `${label} : avertissement.`, kind: "err" });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const askSupport = async () => {
    if (!question.trim()) return;
    setBusy("support");
    try {
      const r = await fetch("/api/support", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: Number(id), question }),
      });
      const j = await apiJson<{ ok?: boolean; answer?: string; engine?: string }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — réessaie.", kind: "err" }); return; }
      if (j.ok && j.answer) { setAnswer(j.answer); setQuestion(""); setToast({ msg: `Support a répondu (${j.engine === "llm" ? "LLM" : "script réflexe"}).`, kind: "ok" }); }
    } finally {
      setBusy(null);
    }
  };

  if (!p) return <div className="text-[13px] py-10 text-center" style={{ color: "var(--text-faint)" }}>Chargement du lead…</div>;

  const stageIdx = TIMELINE.findIndex((t) => t.stage === p.stage);
  const rating = parseFloat(String(p.rating ?? "0"));

  const ACTIONS: { when: boolean; action: string; label: string; primary?: boolean }[] = [
    { when: p.stage === "discovered", action: "validate", label: "Valider la fiche GMB" },
    { when: p.stage === "validated", action: "verify", label: "Vérifier l'email" },
    { when: p.stage === "email_verified", action: "map", label: "Remplir la fiche client" },
    { when: p.stage === "mapped", action: "build", label: "Générer le site (Coder)" },
    { when: p.stage === "site_built", action: "deploy", label: "Déployer (Vercel)" },
    { when: p.stage === "deployed", action: "contact", label: "Envoyer l'offre (Brevo)" },
    { when: p.stage === "contacted", action: "payment", label: "Lien de paiement Whop" },
    { when: p.paymentStatus !== "paid" && p.stage !== "contacted" && p.stage !== "deployed" && p.paymentUrl != null, action: "mark_paid", label: "Marquer payé" },
    { when: p.stage === "paid", action: "domain", label: "Lier le domaine" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/pipeline" className="flex items-center gap-1.5 text-[12.5px] no-underline w-fit" style={{ color: "var(--text-dim)" }}>
        <ArrowLeft size={13} /> Retour au pipeline
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="font-display font-bold text-[23px] text-white">{p.businessName}</h1>
              <span className="chip" style={stageChipStyle(p.stage)}>
                <span className="dot" style={{ background: STAGE_COLORS[p.stage], width: 5, height: 5, boxShadow: "none", animation: "none" }} />
                {STAGE_LABELS[p.stage]}
              </span>
              <span className="chip font-mono" style={{ color: "var(--text-faint)" }}>#{p.id} · {p.source === "serper" ? "SERPER LIVE" : "SIMULATION"}</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap text-[12.5px]" style={{ color: "var(--text-dim)" }}>
              <span className="capitalize">{p.businessType}</span>
              {rating > 0 && <Stars rating={rating} />}
              <span>{p.reviewCount ?? 0} avis</span>
              {p.hasWebsite ? <span style={{ color: "var(--red)" }}>⚠ possède un site</span> : <span style={{ color: "var(--accent)" }}>✓ sans site web</span>}
              {p.emailStatus === "valid" && <span style={{ color: "var(--violet)" }}>✓ email vérifié</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ACTIONS.filter((a) => a.when).map((a) => (
              <button key={a.action} className={a.primary ? "btn-primary" : "btn-ghost"} disabled={busy !== null} onClick={() => act(a.action, a.label)}>
                {busy === a.action ? <Loader2 size={13} className="animate-spin" /> : null}
                {a.label}
              </button>
            ))}
            {p.stage !== "rejected" && p.stage !== "domain_linked" && (
              <button className="btn-primary" disabled={busy !== null} onClick={() => act("full", "Pipeline complet")}>
                {busy === "full" ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Pipeline complet
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-0 mt-6 overflow-x-auto pb-1">
          {TIMELINE.map((t, i) => {
            const done = p.stage === "rejected" ? i === 0 : i <= stageIdx;
            const current = i === stageIdx && p.stage !== "rejected";
            return (
              <div key={t.stage} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1 px-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                    background: done ? `${STAGE_COLORS[t.stage]}20` : "rgba(255,255,255,.04)",
                    border: `1px solid ${done ? STAGE_COLORS[t.stage] + "66" : "var(--border)"}`,
                    boxShadow: current ? `0 0 14px ${STAGE_COLORS[t.stage]}55` : "none",
                  }}>
                    <t.icon size={13} style={{ color: done ? STAGE_COLORS[t.stage] : "var(--text-faint)" }} />
                  </div>
                  <span className="text-[9px] font-mono text-center leading-tight" style={{ color: done ? "var(--text-dim)" : "var(--text-faint)" }}>
                    {t.label}
                  </span>
                </div>
                {i < TIMELINE.length - 1 && <div className="w-5 h-px flex-shrink-0" style={{ background: i < stageIdx ? STAGE_COLORS[t.stage] : "var(--border)" }} />}
              </div>
            );
          })}
        </div>
        {p.rejectReason && (
          <div className="mt-4 px-4 py-3 rounded-xl text-[12.5px]" style={{ background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", color: "var(--red)" }}>
            Rejeté par Validator : {p.rejectReason}
          </div>
        )}
      </div>

      {/* Emails envoyés (archive Saler) */}
      <div className="card p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="label-xs">Emails envoyés à ce lead</div>
          {p.salesEmailId && (mails.data?.emails ?? []).length === 0 && (
            <button onClick={backfillMails} disabled={busy !== null} className="btn-ghost text-[12px]" style={{ borderRadius: 8, padding: "5px 10px" }}>
              {busy === "backfill" ? <Loader2 size={12} className="animate-spin" /> : "Récupérer depuis Brevo"}
            </button>
          )}
        </div>
        {(mails.data?.emails ?? []).length === 0 ? (
          <div className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
            {p.salesEmailId ? "Envoyé avant la création de l'archive — contenu récupérable via le bouton ci-dessus." : "Aucun email envoyé pour l'instant."}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(mails.data?.emails ?? []).map((m) => {
              const color = m.status === "failed" ? "#ff5c7a" : m.status === "simulated" ? "#e5c651" : "var(--accent)";
              return (
                <div key={m.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <button onClick={() => openMailDetail(m.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 no-underline">
                    <span className="chip text-[10px] shrink-0" style={{ color, borderColor: `${color}44` }}>{m.status === "failed" ? "Échec" : m.status === "simulated" ? "Simulé" : "Envoyé"}</span>
                    <span className="text-[12.5px] font-medium text-white truncate min-w-0 flex-1">{m.subject ?? "(sans objet)"}</span>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: "var(--text-faint)" }}>
                      {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </button>
                  {openMail?.id === m.id && (
                    openMail.bodyHtml ? (
                      <iframe sandbox="" srcDoc={openMail.bodyHtml} title={m.subject ?? "Email"} style={{ width: "100%", minHeight: 380, background: "#fff", border: 0 }} />
                    ) : (
                      <div className="p-3 text-[12px]" style={{ color: "var(--text-faint)" }}>
                        {openMail.subject === null ? "Chargement du contenu…" : "Contenu non archivé — cliquez sur « Récupérer depuis Brevo »."}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Contact / GMB */}
        <div className="card p-5 flex flex-col gap-3">
          <div className="label-xs">Fiche Google My Business</div>
          {[
            { icon: Phone, label: "Téléphone", value: p.phone ?? "—" },
            { icon: Mail, label: "Email", value: p.email ?? "non trouvé" },
            { icon: MapPin, label: "Adresse", value: `${p.address ?? ""} ${p.zip ?? ""} ${p.city ?? ""}`.trim() || "—" },
            { icon: Globe, label: "Pays / Source", value: `${p.country ?? "—"} · ${p.searchQuery ?? "—"}` },
            { icon: Star, label: "Note Google", value: `${rating.toFixed(1)}/5 · ${p.reviewCount ?? 0} avis` },
            { icon: Clock, label: "Créé", value: new Date(p.createdAt).toLocaleString("fr-FR") },
          ].map((r) => (
            <div key={r.label} className="flex items-start gap-3 text-[12.5px]">
              <r.icon size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
              <div>
                <div className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: "var(--text-faint)" }}>{r.label}</div>
                <div style={{ color: "var(--text)" }}>{r.value}</div>
              </div>
            </div>
          ))}
          {p.emailDetail && (
            <div className="text-[11px] px-3 py-2.5 rounded-lg" style={{ background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.25)", color: "var(--violet)" }}>
              Emailor : {p.emailDetail}
            </div>
          )}
          {typeof p.aiScore === "number" && (
            <div className="px-3 py-2.5 rounded-lg" style={{ background: "rgba(0,229,160,.06)", border: "1px solid rgba(0,229,160,.22)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: "var(--accent)" }}>Potentiel évalué par Validator</span>
                <span className="font-mono text-[12px] font-bold" style={{ color: "var(--accent)" }}>{p.aiScore}/100</span>
              </div>
              <div className="progress mb-2"><div className="progress-fill" style={{ width: `${p.aiScore}%`, background: "var(--accent)" }} /></div>
              {p.aiInsight && <div className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{p.aiInsight}</div>}
            </div>
          )}
          {p.mapsLink && (
            <a href={p.mapsLink} target="_blank" rel="noopener" className="btn-ghost w-fit !text-[11.5px]">
              <ExternalLink size={12} /> Voir sur Google Maps
            </a>
          )}
        </div>

        {/* Client sheet */}
        <div className="xl:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="label-xs">Fiche client — Mapper ({p.clientData ? Object.keys(p.clientData).length : 0} champs)</div>
            {p.clientData && (
              <button className="btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={() => copy(JSON.stringify(p.clientData, null, 2))}>
                {copied ? <Check size={11} style={{ color: "var(--accent)" }} /> : <Copy size={11} />} Copier JSON
              </button>
            )}
          </div>
          {!p.clientData ? (
            <p className="text-[12.5px] py-6 text-center" style={{ color: "var(--text-faint)" }}>
              La fiche n'est pas encore remplie. Avancez le lead jusqu'à l'étape de Mapper.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0" style={{ maxHeight: 420, overflowY: "auto" }}>
              {SHEET_FIELDS.filter((f) => p.clientData![f]).map((f) => (
                <div key={f} className="flex items-start gap-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
                  <span className="font-mono text-[10px] w-32 flex-shrink-0 pt-0.5" style={{ color: "var(--text-faint)" }}>{f}</span>
                  <span className="text-[12px] break-all" style={{ color: "var(--text)" }}>
                    {f.endsWith("COLOR") || f === "NEUTRAL_BG" ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 rounded inline-block border" style={{ background: p.clientData![f], borderColor: "var(--border)" }} />
                        {p.clientData![f]}
                      </span>
                    ) : f === "HERO_IMAGE_URL" || f === "MAPS_LINK" ? (
                      <span className="opacity-70">{String(p.clientData![f]).slice(0, 60)}…</span>
                    ) : p.clientData![f]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Site preview */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <Monitor size={16} style={{ color: "var(--pink)" }} />
          <span className="font-display font-bold text-[15px] text-white">Site généré par Coder</span>
          {p.hasSite && <span className="chip font-mono" style={{ color: "var(--text-faint)" }}>{(p.siteSize / 1024).toFixed(0)} Ko · {p.siteSlug}</span>}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button className={`btn-ghost !py-1.5 !px-3 !text-[11px] ${device === "desktop" ? "!border-accent" : ""}`} style={device === "desktop" ? { color: "var(--accent)", borderColor: "rgba(0,229,160,.4)" } : {}} onClick={() => setDevice("desktop")}>
              <Monitor size={12} /> Desktop
            </button>
            <button className="btn-ghost !py-1.5 !px-3 !text-[11px]" style={device === "mobile" ? { color: "var(--accent)", borderColor: "rgba(0,229,160,.4)" } : {}} onClick={() => setDevice("mobile")}>
              <Smartphone size={12} /> Mobile
            </button>
            <a href={`/api/prospects/${p.id}/preview`} target="_blank" rel="noopener" className="btn-ghost !py-1.5 !px-3 !text-[11px]">
              <ExternalLink size={12} /> Plein écran
            </a>
          </div>
        </div>
        {p.hasSite ? (
          <div className="flex justify-center py-6" style={{ background: "rgba(0,0,0,.35)" }}>
            <div className="rounded-2xl overflow-hidden border" style={{
              width: device === "desktop" ? "min(1060px, 94%)" : 390,
              height: device === "desktop" ? 620 : 700,
              borderColor: "var(--border-strong)",
              boxShadow: "0 30px 80px rgba(0,0,0,.5)",
            }}>
              <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ background: "rgba(15,19,26,.98)", borderBottom: "1px solid var(--border)" }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f87171" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#fbbf24" }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#34d399" }} />
                <span className="ml-3 font-mono text-[10.5px] px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,.06)", color: "var(--text-dim)" }}>
                  {p.deployedUrl ?? `/preview/${p.siteSlug}`}
                </span>
              </div>
              <iframe className="preview-frame" style={{ height: "calc(100% - 38px)" }} src={`/api/prospects/${p.id}/preview`} sandbox="allow-scripts" title={`Site ${p.businessName}`} />
            </div>
          </div>
        ) : (
          <div className="py-14 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
            Aucun site généré. Faites passer le lead par <b style={{ color: "var(--pink)" }}>Coder</b> (étape "Générer le site") ou lancez le pipeline complet.
          </div>
        )}
        {/* Delivery status strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-t" style={{ borderColor: "var(--border)" }}>
          {[
            { icon: Rocket, label: "Déploiement", value: p.deployedUrl ?? "—", ok: Boolean(p.deployedUrl) },
            { icon: Send, label: "Offre envoyée", value: p.contactedAt ? new Date(p.contactedAt).toLocaleString("fr-FR") : "—", ok: Boolean(p.contactedAt) },
            { icon: CreditCard, label: "Paiement", value: p.paymentStatus === "none" ? "—" : p.paymentStatus, ok: p.paymentStatus === "paid" || p.paymentStatus === "simulated" },
            { icon: Globe, label: "Domaine", value: p.domainUrl ?? "—", ok: Boolean(p.domainUrl) },
          ].map((r) => (
            <div key={r.label} className="px-5 py-4 border-r last:border-r-0" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <div className="flex items-center gap-2 mb-1">
                <r.icon size={13} style={{ color: r.ok ? "var(--accent)" : "var(--text-faint)" }} />
                <span className="text-[10.5px] uppercase tracking-wider font-bold" style={{ color: "var(--text-faint)" }}>{r.label}</span>
              </div>
              <div className="font-mono text-[11px] truncate" style={{ color: r.ok ? "var(--accent)" : "var(--text-faint)" }} title={r.value}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes internes */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-1.5">
          <StickyNote size={16} style={{ color: "var(--amber)" }} />
          <h2 className="font-display font-bold text-[16px] text-white">Notes internes</h2>
          <span className="chip font-mono" style={{ color: "var(--text-faint)" }}>{notes.length}</span>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--text-dim)" }}>
          Contexte, décisions et consignes partagés avec RIO — il les lit quand vous lui demandez ce lead.
        </p>
        <div className="flex gap-2.5 mb-4">
          <input className="input flex-1" placeholder="Ex. Rappeler lundi · propriétaire intéressé par le pack premium"
            value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
          <button className="btn-primary" onClick={addNote} disabled={busy === "note" || !noteText.trim()}>
            {busy === "note" ? <Loader2 size={14} className="animate-spin" /> : <StickyNote size={14} />} Ajouter
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>Aucune note pour ce lead.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--border)" }}>
                <span className="chip flex-shrink-0" style={{ color: "var(--amber)", borderColor: "rgba(251,191,36,.3)", fontSize: 10 }}>{n.author}</span>
                <span className="text-[12.5px] flex-1" style={{ color: "var(--text)" }}>{n.body}</span>
                <span className="font-mono text-[10px] flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                  {new Date(n.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Support box */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-1.5">
          <LifeBuoy size={16} style={{ color: "var(--pink)" }} />
          <h2 className="font-display font-bold text-[16px] text-white">Support — réponse client</h2>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--text-dim)" }}>
          Simulez un message entrant du client : Support répond via le LLM omniroute (ou son script réflexe si LLM non configuré).
        </p>
        <div className="flex gap-2.5">
          <input className="input flex-1" placeholder={`Ex. "Pouvez-vous changer les horaires dimanche et la couleur du bouton ?"`}
            value={question} onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askSupport()} />
          <button className="btn-primary" onClick={askSupport} disabled={busy === "support" || !question.trim()}>
            {busy === "support" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Répondre
          </button>
        </div>
        {answer && (
          <div className="mt-4 px-4 py-3.5 rounded-xl text-[13px] leading-relaxed" style={{ background: "rgba(0,229,160,.06)", border: "1px solid rgba(0,229,160,.2)", color: "var(--text)" }}>
            {answer}
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
