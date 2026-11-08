"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Save, Loader2, Bot, BrainCircuit, MailPlus, Triangle, CreditCard, Store,
  KeyRound, Eye, EyeOff, Shield, Zap, FlaskConical, RefreshCw, Inbox,
  Sparkles, CheckCircle2, XOctagon,
} from "lucide-react";
import { Toast, apiJson } from "@/components/ui";
import { SetupWizard } from "@/components/setup-wizard";

type Group = {
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean; hint?: string }[];
  tester?: { url: string; button: string };
};

type ProbeRow = { label: string; ok: boolean; info: string };

const GROUPS: Group[] = [
  {
    title: "Gemini — moteur du Coder", icon: Sparkles, color: "#4285F4",
    desc: "Le moteur preferé du Coder pour générer les sites : 1 clé = 1 compte Google AI Studio = 20 sites gratuits/jour. Rotation automatique entre comptes, repli LLM omniroute puis gabarit si tout est épuisé.",
    tester: { url: "/api/settings/gemini", button: "Tester les clés" },
    fields: [
      { key: "GEMINI_API_KEYS", label: "Clés API (une par compte Gmail)", placeholder: "AIza…,AIza…,AIza…", secret: true, hint: "aistudio.google.com/apikey — jusqu'à 3 comptes séparés par des virgules. Le quota gratuit Gemini se réinitialise à minuit heure du Pacifique." },
    ],
  },
  {
    title: "LLM — omniroute", icon: BrainCircuit, color: "#a78bfa",
    desc: "Le cerveau de RIO (chat, raisonnement, outils) et de Coder (génération des sites). API compatible OpenAI.",
    fields: [
      { key: "LLM_BASE_URL", label: "BASE_URL", placeholder: "https://api.omniroute.ai/v1", hint: "Doit se terminer par /v1" },
      { key: "LLM_API_KEY", label: "API_KEY", placeholder: "sk-…", secret: true },
      { key: "LLM_MODEL", label: "MODEL", placeholder: "gpt-4o-mini", hint: "Un modèle supportant le function-calling est requis pour RIO" },
    ],
  },
  {
    title: "Telegram Bot", icon: Bot, color: "#38bdf8",
    desc: "Le canal de RIO : notifications en temps réel et conversation IA à distance. Le webhook s'enregistre tout seul après sauvegarde.",
    fields: [
      { key: "TELEGRAM_BOT_TOKEN", label: "Bot Token", placeholder: "123456:ABC-DEF…", secret: true, hint: "Créé via @BotFather" },
      { key: "TELEGRAM_CHAT_ID", label: "Chat ID (RIO)", placeholder: "rempli automatiquement au /start", hint: "Envoyez /start au bot : il se remplit seul" },
    ],
  },
  {
    title: "Brevo — SMTP transactionnel", icon: MailPlus, color: "#fb923c",
    desc: "Saler envoie les offres commerciales personnalisées avec le lien de prévisualisation du site.",
    fields: [
      { key: "BREVO_API_KEY", label: "Clé API", placeholder: "xkeysib-…", secret: true },
      { key: "BREVO_SENDER_EMAIL", label: "Email expéditeur", placeholder: "hello@votre-domaine.com", hint: "Doit être validé dans Brevo" },
      { key: "BREVO_SENDER_NAME", label: "Nom expéditeur", placeholder: "GoSite Digital" },
    ],
  },
  {
    title: "Vercel — Déploiement", icon: Triangle, color: "#60a5fa",
    desc: "Deployer publie chaque site en sous-domaine {idClient}.{domaine-agence} ; Domainner lie les domaines finaux.",
    fields: [
      { key: "VERCEL_TOKEN", label: "Token Vercel", placeholder: "vercel_…", secret: true, hint: "vercel.com/account/tokens" },
      { key: "VERCEL_TEAM_ID", label: "Team ID (optionnel)", placeholder: "team_…" },
    ],
  },
  {
    title: "Whop — Paiements", icon: CreditCard, color: "#4ade80",
    desc: "Paymer génère les liens de paiement. Ajoutez le webhook Whop vers /api/webhooks/whop pour l'encaissement automatique.",
    fields: [
      { key: "WHOP_API_KEY", label: "Clé API Whop", placeholder: "whk_…", secret: true },
      { key: "WHOP_COMPANY_ID", label: "Company ID", placeholder: "biz_…" },
      { key: "WHOP_PLAN_ID", label: "Plan ID", placeholder: "plan_…" },
    ],
  },
  {
    title: "Agence & Offre commerciale", icon: Store, color: "#00e5a0",
    desc: "Le domaine des sous-domaines clients et le montant annoncé par Saler dans l'email d'offre.",
    fields: [
      { key: "AGENCY_DOMAIN", label: "Domaine agence", placeholder: "gosite.digital" },
      { key: "AGENCY_ADDRESS", label: "Adresse légale (footer emails)", placeholder: "12 rue Exemple, 75000 Ville", hint: "Mention obligatoire dans les emails commerciaux (CAN-SPAM / LCEN)" },
      { key: "OFFER_PRICE", label: "Prix de l'offre", placeholder: "490" },
      { key: "OFFER_CURRENCY", label: "Devise", placeholder: "EUR / MAD / USD" },
    ],
  },
  {
    title: "Réception — Cloudflare Email", icon: Inbox, color: "#f472b6",
    desc: "Les réponses clients arrivent sur l'email de réception (Worker Cloudflare) ; Saler, Paymer et Support les lisent et y répondent. Installation : docs/cloudflare-email-worker.md.",
    fields: [
      { key: "CONTACT_EMAIL", label: "Email de réception", placeholder: "contact@gosite.digital", hint: "URL webhook du Worker : https://gosite.digital/api/webhooks/email?secret=<Secret webhook>" },
      { key: "AUTO_REPLY_ENABLED", label: "Réponses automatiques", placeholder: "off", hint: "on|off — off = notifications Telegram seulement (recommandé la première semaine)" },
      { key: "AUTO_REPLY_HOURLY_CAP", label: "Cap global / heure", placeholder: "20", hint: "Nombre max de réponses automatiques par heure (protection anti-boucle)" },
      { key: "EMAIL_WEBHOOK_SECRET", label: "Secret webhook", placeholder: "36 caractères hex", secret: true },
    ],
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [probe, setProbe] = useState<{ rows?: ProbeRow[]; busy: boolean }>({ busy: false });
  const [wizardKey, setWizardKey] = useState(0);

  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/settings", { cache: "no-store" });
    const j = await apiJson<{ settings?: Record<string, string> }>(r);
    if (j) setValues(j.settings ?? {});
    setLoaded(true);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const patch = async (body: Record<string, string>, label: string) => {
    setSaving(label);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await apiJson<{ updated?: string[] }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — modifications non enregistrées.", kind: "err" }); return; }
      setToast({ msg: j.updated?.length ? `${label} enregistré.` : "Aucun changement à enregistrer.", kind: "ok" });
      await loadSettings();
      setWizardKey((k) => k + 1);
    } finally { setSaving(null); }
  };

  const saveGroup = async (g: Group) => {
    const body: Record<string, string> = {};
    for (const f of g.fields) body[f.key] = values[f.key] ?? "";
    await patch(body, g.title);
  };

  const sysToggle = async (key: "AUTOPILOT" | "ALLOW_SIMULATION", next: boolean) => {
    setValues((v) => ({ ...v, [key]: next ? "true" : "false" }));
    await patch({ [key]: next ? "true" : "false" }, key === "AUTOPILOT" ? "Auto-pilote" : "Mode test");
  };

  const runGeminiProbe = async (g: Group) => {
    if (!g.tester) return;
    setProbe({ busy: true });
    try {
      const r = await fetch(g.tester.url, { cache: "no-store" });
      const j = await apiJson<{ probe?: ProbeRow[] }>(r);
      if (j?.probe) {
        setProbe({ rows: j.probe, busy: false });
        if (!j.probe.length) setToast({ msg: "Aucune clé Gemini configurée — collez-les puis sauvez d'abord.", kind: "err" });
      } else {
        setProbe({ busy: false });
        setToast({ msg: "Test impossible — serveur momentanément indisponible.", kind: "err" });
      }
    } finally {
      setProbe((p) => ({ ...p, busy: false }));
    }
  };

  const autopilotOn = values.AUTOPILOT === "true";
  const simOn = values.ALLOW_SIMULATION === "true";

  return (
    <div className="flex flex-col gap-6 max-w-[920px]">
      <div>
        <h1 className="font-display font-bold text-[24px] text-white">Réglages & Intégrations<span style={{ color: "var(--accent)" }}>.</span></h1>
        <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
          Tout est stocké en base PostgreSQL (persistant, partagé par tous les agents et les cycles cron) — jamais en local.
          Les clés <b style={{ color: "var(--cyan)" }}>Serper.dev</b> se gèrent sur la page{" "}
          <Link href="/agents" className="underline" style={{ color: "var(--cyan)" }}>Agents</Link> (rotation automatique).
        </p>
      </div>

      {/* Assistant */}
      <SetupWizard key={wizardKey} onChanged={loadSettings} />

      {/* Système & Auto-pilote — contrôles explicites */}
      <div className="card p-6">
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(248,113,113,.1)", border: "1px solid rgba(248,113,113,.28)" }}>
            <Shield size={17} style={{ color: "#f87171" }} />
          </div>
          <div>
            <h2 className="font-display font-bold text-[15.5px] text-white">Système & Auto-pilote</h2>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Les deux interrupteurs qui déterminent le comportement global de l'agence.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Autopilot */}
          <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "rgba(0,0,0,.25)", border: `1px solid ${autopilotOn ? "rgba(0,229,160,.25)" : "var(--border)"}` }}>
            <Zap size={16} className="mt-0.5 flex-shrink-0" style={{ color: autopilotOn ? "var(--accent)" : "var(--text-faint)" }} />
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-white mb-1">Auto-pilote 24/7</div>
              <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Quand il est actif, chaque cycle exécute les missions récurrentes puis fait avancer tout le pipeline
                (qualification → vérification email → fiche client → site → déploiement → offre), en respectant les agents en pause.
                {autopilotOn ? " Actuellement : les cycles tournent." : " Actuellement : aucun cycle automatique."}
              </p>
            </div>
            <button type="button" className={`switch ${autopilotOn ? "on" : ""}`} onClick={() => sysToggle("AUTOPILOT", !autopilotOn)} aria-label="auto-pilote" />
          </div>

          {/* Simulation */}
          <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "rgba(0,0,0,.25)", border: `1px solid ${simOn ? "rgba(251,191,36,.3)" : "var(--border)"}` }}>
            <FlaskConical size={16} className="mt-0.5 flex-shrink-0" style={{ color: simOn ? "var(--amber)" : "var(--text-faint)" }} />
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold text-white mb-1">
                Mode test {simOn ? <span style={{ color: "var(--amber)" }}>(activé)</span> : <span style={{ color: "var(--accent)" }}>(désactivé — production stricte)</span>}
              </div>
              <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Désactivé (recommandé) : aucune donnée n'est inventée. Si une clé manque, l'agent renvoie une erreur explicite.
                Activé : les agents sans clé produisent des données de démonstration — à n'utiliser que pour tester l'interface.
              </p>
            </div>
            <button type="button" className={`switch ${simOn ? "on" : ""}`} onClick={() => sysToggle("ALLOW_SIMULATION", !simOn)} aria-label="mode test" />
          </div>

          {/* Technical fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
            {[
              { key: "APP_BASE_URL", label: "URL publique de l'app", placeholder: "https://votre-app.vercel.app", hint: "Sert au webhook Telegram et aux liens envoyés aux clients", secret: false },
              { key: "CRON_SECRET", label: "Secret cron", placeholder: "généré par l'assistant", hint: "Protège /api/cron/tick contre les appels externes", secret: true },
            ].map((f) => (
              <div key={f.key}>
                <label className="label-xs flex items-center gap-1.5 mb-1.5">{f.secret && <KeyRound size={10} />} {f.label}</label>
                <div className="relative">
                  <input className="input font-mono !text-[12.5px]"
                    type={f.secret && !visible[f.key] ? "password" : "text"}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                  {f.secret && (
                    <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer" style={{ color: "var(--text-faint)" }}
                      onClick={() => setVisible((v) => ({ ...v, [f.key]: !v[f.key] }))}>
                      {visible[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
                <div className="text-[10.5px] mt-1" style={{ color: "var(--text-faint)" }}>{f.hint}</div>
              </div>
            ))}
          </div>
          <button className="btn-primary w-fit !py-2" onClick={() => patch({ APP_BASE_URL: values.APP_BASE_URL ?? "", CRON_SECRET: values.CRON_SECRET ?? "" }, "Système")}>
            {saving === "Système" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
          </button>
        </div>
      </div>

      {/* API groups */}
      {!loaded ? (
        <div className="text-[13px] py-10 text-center" style={{ color: "var(--text-faint)" }}>Chargement…</div>
      ) : (
        GROUPS.map((g) => (
          <div key={g.title} className="card p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: g.color + "14", border: `1px solid ${g.color}33` }}>
                  <g.icon size={17} style={{ color: g.color }} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-[15.5px] text-white">{g.title}</h2>
                  <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>{g.desc}</p>
                </div>
              </div>
              <button className="btn-primary !py-2" onClick={() => saveGroup(g)} disabled={saving === g.title}>
                {saving === g.title ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Sauver
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {g.fields.map((f, i) => (
                <div key={f.key} className={g.fields.length % 2 === 1 && i === g.fields.length - 1 ? "md:col-span-2" : ""}>
                  <label className="label-xs flex items-center gap-1.5 mb-1.5">
                    {f.secret && <KeyRound size={10} />} {f.label}
                  </label>
                  <div className="relative">
                    <input
                      className="input font-mono !text-[12.5px]"
                      type={f.secret && !visible[f.key] ? "password" : "text"}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                    {f.secret && (
                      <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-0 cursor-pointer" style={{ color: "var(--text-faint)" }}
                        onClick={() => setVisible((v) => ({ ...v, [f.key]: !v[f.key] }))}>
                        {visible[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                  {f.hint && <div className="text-[10.5px] mt-1" style={{ color: "var(--text-faint)" }}>{f.hint}</div>}
                </div>
              ))}
            </div>
            {g.tester && (
              <div className="mt-4 flex flex-col gap-2">
                <button className="btn-primary w-fit !py-2" onClick={() => runGeminiProbe(g)} disabled={probe.busy}>
                  {probe.busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {g.tester.button}
                </button>
                {probe.rows && probe.rows.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {probe.rows.map((row) => (
                      <div key={row.label} className="flex items-start gap-2 text-[12px] p-2.5 rounded-lg" style={{ background: "rgba(0,0,0,.25)", border: `1px solid ${row.ok ? "rgba(0,229,160,.3)" : "rgba(248,113,113,.3)"}` }}>
                        {row.ok ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} /> : <XOctagon size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#f87171" }} />}
                        <span className="text-white font-semibold flex-shrink-0">{row.label} :</span>
                        <span style={{ color: "var(--text-dim)" }}>{row.info}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}

      <div className="flex items-center gap-2 text-[11.5px] pb-4" style={{ color: "var(--text-faint)" }}>
        <RefreshCw size={11} /> Les secrets sont masqués après enregistrement et ne sont jamais renvoyés en clair au navigateur.
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
