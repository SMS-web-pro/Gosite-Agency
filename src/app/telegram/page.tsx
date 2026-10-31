"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Copy, Check, Loader2, Bot, Terminal, Webhook, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { useApi, Toast } from "@/components/ui";
import type { StatsPayload, ActivityRow } from "@/app/page";

const COMMANDS = [
  { cmd: "/status", desc: "Vue d'ensemble du pipeline (compteurs par étape)" },
  { cmd: "/agents", desc: "État de santé des 10 agents (prêt / en cours / pause / erreur)" },
  { cmd: "/leads", desc: "Les 8 derniers leads importés avec stage" },
  { cmd: "/scout barbershop Casablanca", desc: "Lance une mission de prospection (Prospector + notification finale)" },
  { cmd: "/validate", desc: "Validator qualifie tous les leads en attente (⭐≥4,0 · ≥10 avis · sans site · email)" },
  { cmd: "/run 12", desc: "Exécute le pipeline complet pour le lead #12 (jusqu'à l'envoi de l'offre)" },
  { cmd: "/tick", desc: "Force un cycle complet de l'auto-pilote 24/7" },
  { cmd: "/pause coder", desc: "Met l'agent Coder en pause" },
  { cmd: "/resume coder", desc: "Réactive l'agent Coder" },
];

type WebhookState = {
  ok: boolean; expectedUrl?: string; urlMatches?: boolean;
  info?: { url: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number; max_connections?: number };
  error?: string;
};

export default function TelegramPage() {
  const { data } = useApi<StatsPayload>("/api/stats", 8000);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [sending, setSending] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [hook, setHook] = useState<WebhookState | null>(null);
  const [tgAct, setTgAct] = useState<ActivityRow[]>([]);
  const configured = Boolean(data?.integrations?.telegram);

  const loadDiag = useCallback(async () => {
    try {
      const r = await fetch("/api/telegram/register");
      const j = (await r.json()) as WebhookState;
      setHook(j);
      // Auto-réparation : si le bot est configuré mais le webhook manquant/incorrect → enregistrement automatique
      if (j.ok && !j.urlMatches) {
        setRegistering(true);
        const r2 = await fetch("/api/telegram/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const j2 = await r2.json();
        setRegistering(false);
        if (j2.ok) {
          setToast({ msg: `Webhook enregistré automatiquement → ${j2.url}`, kind: "ok" });
          const r3 = await fetch("/api/telegram/register");
          setHook(await r3.json());
        }
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => { loadDiag(); }, [loadDiag]);
  useEffect(() => {
    if (data?.activity) setTgAct(data.activity.filter((a) => a.agentKey === "telegram").slice(0, 12));
  }, [data]);

  const copy = async (t: string) => {
    await navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const forceRegister = async () => {
    setRegistering(true);
    try {
      const r = await fetch("/api/telegram/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json();
      setToast({ msg: j.ok ? `Webhook enregistré : ${j.url}` : j.error ?? "Échec d'enregistrement", kind: j.ok ? "ok" : "err" });
      await loadDiag();
    } finally {
      setRegistering(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const r = await fetch("/api/telegram/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testMsg || undefined }),
      });
      const j = await r.json();
      setToast({ msg: j.ok ? "Message reçu sur Telegram." : j.error ?? "Envoi échoué", kind: j.ok ? "ok" : "err" });
      if (j.ok) setTestMsg("");
    } finally {
      setSending(false);
    }
  };

  const webhookUrl = hook?.expectedUrl ?? "…";

  return (
    <div className="flex flex-col gap-6 max-w-[980px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[24px] text-white">Telegram Ops<span style={{ color: "var(--accent)" }}>.</span></h1>
          <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
            Le poste de commandement de poche de RIO : notifications en temps réel à chaque jalon, pilotage complet à distance.
          </p>
        </div>
        <span className="chip" style={configured ? { color: "var(--accent)", borderColor: "rgba(0,229,160,.35)", background: "var(--accent-dim)" } : { color: "var(--amber)", borderColor: "rgba(251,191,36,.35)" }}>
          <Bot size={11} /> {configured ? "BOT CONFIGURÉ" : "TOKEN MANQUANT"}
        </span>
      </div>

      {/* Webhook diagnostics — auto-repair */}
      <div className="card p-6" style={hook && !hook.urlMatches && hook.ok ? { borderColor: "rgba(251,191,36,.35)" } : {}}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-bold text-[16px] text-white flex items-center gap-2">
            <Webhook size={16} style={{ color: "var(--cyan)" }} /> État du webhook
          </h2>
          <div className="flex items-center gap-2">
            <button className="btn-ghost !py-2" onClick={loadDiag}><RefreshCw size={13} /> Actualiser</button>
            <button className="btn-primary !py-2" onClick={forceRegister} disabled={registering || !configured}>
              {registering ? <Loader2 size={13} className="animate-spin" /> : <Webhook size={13} />} Enregistrer / réparer
            </button>
          </div>
        </div>
        {!hook ? (
          <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>Diagnostic en cours…</p>
        ) : !hook.ok ? (
          <div className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--amber)" }}>
            <AlertTriangle size={14} /> {hook.error} — collez le token dans Réglages → Telegram Bot.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[12.5px]">
            <div className="flex justify-between gap-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <span className="label-xs">URL enregistrée chez Telegram</span>
              <span className="font-mono text-[11px] text-right break-all" style={{ color: hook.info?.url ? "var(--accent)" : "var(--amber)" }}>
                {hook.info?.url || "aucune — enregistrement requis"}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <span className="label-xs">URL attendue (cette app)</span>
              <span className="font-mono text-[11px] text-right break-all" style={{ color: "var(--text-dim)" }}>{hook.expectedUrl}</span>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <span className="label-xs">Correspondance</span>
              <span className="font-mono text-[11px]" style={{ color: hook.urlMatches ? "var(--accent)" : "var(--amber)" }}>
                {hook.urlMatches ? "OK — le bot répond" : "MISMATCH — cliquez « Enregistrer / réparer »"}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <span className="label-xs">File d'attente / dernière erreur</span>
              <span className="font-mono text-[11px]" style={{ color: hook.info?.last_error_message ? "var(--red)" : "var(--text-dim)" }}>
                {hook.info?.pending_update_count ?? 0} en attente{hook.info?.last_error_message ? ` · ⚠ ${hook.info.last_error_message}` : " · aucune erreur"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Setup */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-[16px] text-white mb-4 flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: "var(--cyan)" }} /> Mise en route en 3 étapes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { n: "01", title: "Créer le bot", text: "Dans Telegram : @BotFather → /newbot → récupérez le token. Collez-le dans Réglages → Telegram Bot : le webhook s'enregistre automatiquement." },
            { n: "02", title: "Démarrer la conversation", text: "Ouvrez votre bot dans Telegram et envoyez /start : votre Chat ID s'enregistre automatiquement en base (persistant)." },
            { n: "03", title: "Commander l'agence", text: "Toutes les commandes ci-dessous fonctionnent immédiatement. Chaque jalon du pipeline vous notifie en temps réel." },
          ].map((s) => (
            <div key={s.n} className="p-4 rounded-xl" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--border)" }}>
              <div className="font-mono text-[11px] mb-2" style={{ color: "var(--accent)" }}>ÉTAPE {s.n}</div>
              <div className="text-[13px] font-semibold text-white mb-1.5">{s.title}</div>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <div className="label-xs mb-1.5 flex items-center gap-1.5"><Webhook size={11} /> URL webhook de cette instance</div>
          <div className="flex gap-2">
            <code className="input font-mono !text-[12px] flex-1 truncate" style={{ paddingTop: 11 }}>{webhookUrl}</code>
            <button className="btn-ghost" onClick={() => copy(webhookUrl)}>{copied ? <Check size={13} style={{ color: "var(--accent)" }} /> : <Copy size={13} />} Copier</button>
          </div>
          <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
            Le webhook est signé d'un secret (x-telegram-bot-api-secret-token) — les appels étrangers sont rejetés.
          </p>
        </div>
      </div>

      {/* Test send */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-[16px] text-white mb-4 flex items-center gap-2">
          <Send size={15} style={{ color: "var(--accent)" }} /> Tester la liaison
        </h2>
        <div className="flex gap-2.5">
          <input className="input flex-1" placeholder="Message de test (vide = ping automatique)…" value={testMsg} onChange={(e) => setTestMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTest()} />
          <button className="btn-primary" onClick={sendTest} disabled={sending || !configured}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer à RIO
          </button>
        </div>
      </div>

      {/* Commands */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-[16px] text-white mb-4 flex items-center gap-2">
          <Terminal size={15} style={{ color: "var(--violet)" }} /> Commandes disponibles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          {COMMANDS.map((c) => (
            <div key={c.cmd} className="flex items-start gap-3 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <code className="font-mono text-[11.5px] px-2 py-1 rounded-lg flex-shrink-0" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(0,229,160,.2)" }}>{c.cmd}</code>
              <span className="text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{c.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] mt-4" style={{ color: "var(--text-faint)" }}>
          Notifications automatiques : missions Prospector (+ rotations de compte et alertes quota), déploiements, offres envoyées, liens Whop, paiements confirmés (webhook Whop), domaines liés, cycles auto-pilote.
        </p>
      </div>

      {/* Recent bot traffic */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-[16px] text-white mb-4 flex items-center gap-2">
          <Bot size={15} style={{ color: "var(--cyan)" }} /> Trafic récent du bot
        </h2>
        {tgAct.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>Aucun échange encore. Envoyez /start depuis Telegram pour initialiser le canal.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tgAct.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--border)" }}>
                <span className="dot" style={{ background: "var(--cyan)", width: 6, height: 6, boxShadow: "none", animation: "none" }} />
                <span className="text-[12.5px] flex-1" style={{ color: "var(--text)" }}>{a.message}</span>
                <span className="font-mono text-[10px] flex-shrink-0" style={{ color: "var(--text-faint)" }}>{new Date(a.createdAt).toLocaleTimeString("fr-FR", { hour12: false })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
