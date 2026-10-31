"use client";

import { useState } from "react";
import { Pause, Play, RefreshCw, KeyRound, Loader2, Brain, Dna, BrainCircuit } from "lucide-react";
import Link from "next/link";
import { useApi, Toast, AGENT_ICONS } from "@/components/ui";
import { AgentBrainPanel } from "@/components/agent-brain-panel";
import type { StatsPayload } from "@/app/page";

const INTEGRATION_BY_AGENT: Record<string, { name: string; key: string }> = {
  prospector: { name: "Serper.dev API", key: "serper" },
  validator: { name: "Règles GMB internes", key: "" },
  emailor: { name: "DNS / MX lookup", key: "" },
  mapper: { name: "Fiche 28 champs", key: "" },
  coder: { name: "LLM omniroute", key: "llm" },
  deployer: { name: "Vercel API", key: "vercel" },
  saler: { name: "Brevo SMTP", key: "brevo" },
  paymer: { name: "Whop API", key: "whop" },
  domainner: { name: "Vercel Domains", key: "vercel" },
  support: { name: "LLM omniroute", key: "llm" },
};

const STATUS_LABEL: Record<string, string> = { ready: "Prêt", running: "En cours", paused: "Pause", error: "Erreur" };

export default function AgentsPage() {
  const { data, reload } = useApi<StatsPayload>("/api/stats", 6000);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [newKey, setNewKey] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const [evolvingAll, setEvolvingAll] = useState(false);

  const brainOnline = Boolean(data?.integrations?.llm);

  const evolveAll = async () => {
    setEvolvingAll(true);
    try {
      const roster = (data?.agents ?? []).map((a) => a.key);
      let grown = 0;
      for (const key of roster) {
        const r = await fetch(`/api/agents/${key}/evolve`, { method: "POST" });
        const j = await r.json();
        if (j.ok && (j.skills?.length || j.learnings?.length)) grown++;
      }
      setToast({ msg: `Auto-amélioration terminée : ${grown} agent(s) ont progressé.`, kind: "ok" });
      await reload();
    } finally { setEvolvingAll(false); }
  };

  const act = async (key: string, action: string) => {
    setBusy(key + action);
    try {
      const r = await fetch(`/api/agents/${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (j.ok) setToast({ msg: `Agent ${key} : action "${action}" appliquée.`, kind: "ok" });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const addSerperKey = async () => {
    if (newKey.trim().length < 10) return;
    setAddingKey(true);
    try {
      const r = await fetch("/api/serper-keys", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: newKey.trim() }),
      });
      const j = await r.json();
      if (j.ok) { setNewKey(""); setToast({ msg: "Clé Serper ajoutée — Prospector passe en mode LIVE.", kind: "ok" }); }
      else setToast({ msg: j.error ?? "Erreur", kind: "err" });
      await reload();
    } finally {
      setAddingKey(false);
    }
  };

  const removeKey = async (id: number) => {
    await fetch(`/api/serper-keys?id=${id}`, { method: "DELETE" });
    setToast({ msg: `Clé #${id} supprimée.`, kind: "ok" });
    await reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[24px] text-white">Équipe d'agents<span style={{ color: "var(--accent)" }}>.</span></h1>
          <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
            Les 10 agents partagent le même cerveau <b style={{ color: "var(--violet)" }}>LLM omniroute</b>, chacun avec sa personnalité métier, ses compétences et sa mémoire d'apprentissage.
          </p>
        </div>
        <button className="btn-primary !py-2" onClick={evolveAll} disabled={evolvingAll || !brainOnline}>
          {evolvingAll ? <Loader2 size={13} className="animate-spin" /> : <Dna size={13} />} Faire évoluer toute l'équipe
        </button>
      </div>

      {/* Bandeau cerveau partagé */}
      <div className="card p-5" style={{ borderColor: brainOnline ? "rgba(167,139,250,.28)" : "rgba(251,191,36,.3)" }}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: brainOnline ? "rgba(167,139,250,.12)" : "rgba(251,191,36,.1)", border: `1px solid ${brainOnline ? "rgba(167,139,250,.35)" : "rgba(251,191,36,.3)"}` }}>
            <BrainCircuit size={20} style={{ color: brainOnline ? "var(--violet)" : "var(--amber)" }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-display font-bold text-[15px] text-white">Cerveau partagé — LLM omniroute</span>
              <span className="chip" style={brainOnline
                ? { color: "var(--violet)", borderColor: "rgba(167,139,250,.35)", background: "rgba(167,139,250,.08)" }
                : { color: "var(--amber)", borderColor: "rgba(251,191,36,.35)" }}>
                {brainOnline ? "CONNECTÉ" : "HORS-LIGNE"}
              </span>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-dim)" }}>
              {brainOnline
                ? "Chaque agent raisonne avec l'IA dans sa tâche : Prospector affine ses requêtes, Validator score le potentiel, Emailor déduit les adresses, Mapper écrit l'identité, Coder construit, Saler rédige l'offre, Domainner nomme les domaines. Tous progressent en s'auto-analysant."
                : "Les agents fonctionnent en mode réflexes (règles). Renseignez LLM_BASE_URL et LLM_API_KEY dans Réglages pour activer l'intelligence sur toute l'équipe."}
            </p>
          </div>
          {!brainOnline && <Link href="/settings" className="btn-ghost !py-2">Configurer</Link>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(data?.agents ?? []).map((a) => {
          const Icon = AGENT_ICONS[a.key] ?? RefreshCw;
          const integ = INTEGRATION_BY_AGENT[a.key];
          const live = integ?.key ? Boolean(data?.integrations[integ.key]) : true;
          const allowSim = data?.allowSimulation ?? false;
          const paused = a.status === "paused";
          const total = Math.max(1, (a.stats?.successes ?? 0) + (a.stats?.failures ?? 0));
          const successRate = Math.round(((a.stats?.successes ?? 0) / total) * 100);
          return (
            <div key={a.key} className="card card-hover p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: a.color + "14", border: `1px solid ${a.color}38` }}>
                  <Icon size={19} style={{ color: a.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-[15.5px] text-white">{a.name}</span>
                    <span className={`dot dot-${a.status}`} />
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: a.color }}>{a.roleTitle}</div>
                </div>
                <span className="chip" style={live ? { color: "var(--accent)", borderColor: "rgba(0,229,160,.3)" } : { color: "var(--amber)", borderColor: "rgba(251,191,36,.35)" }}>
                  {live ? "LIVE" : allowSim ? "MODE TEST" : "À CONFIGURER"}
                </span>
              </div>

              <p className="text-[12px] leading-relaxed flex-1" style={{ color: "var(--text-dim)" }}>{a.description}</p>

              <div className="flex items-center gap-2 text-[10.5px] font-mono" style={{ color: "var(--text-faint)" }}>
                <KeyRound size={11} /> {integ?.name ?? "Core"} · {STATUS_LABEL[a.status]}{a.lastError ? ` · ⚠ ${a.lastError.slice(0, 30)}` : ""}
              </div>

              <div>
                <div className="flex justify-between text-[10.5px] font-mono mb-1.5" style={{ color: "var(--text-dim)" }}>
                  <span>{a.stats?.runs ?? 0} exécutions</span>
                  <span>{a.stats?.runs ? `${successRate}% succès` : "jamais lancé"}</span>
                </div>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${a.stats?.runs ? successRate : 0}%`, background: a.color }} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="btn-ghost !py-1.5 !px-3 !text-[11.5px]" disabled={busy === a.key + (paused ? "resume" : "pause")}
                  onClick={() => act(a.key, paused ? "resume" : "pause")}>
                  {busy?.startsWith(a.key) ? <Loader2 size={12} className="animate-spin" /> : paused ? <Play size={12} /> : <Pause size={12} />}
                  {paused ? "Réactiver" : "Pause"}
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10.5px]" style={{ color: "var(--text-faint)" }}>Auto-pilote</span>
                  <button type="button" className={`switch ${a.autoPilot ? "on" : ""}`} onClick={() => act(a.key, "autopilot")} aria-label="auto-pilote" />
                </div>
              </div>

              <AgentBrainPanel
                agentKey={a.key}
                agentName={a.name}
                color={a.color}
                brainOnline={brainOnline}
                onToast={(msg, kind) => setToast({ msg, kind })}
              />
            </div>
          );
        })}
      </div>

      {/* Prospector panel: Serper rotation */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-bold text-[17px] text-white flex items-center gap-2">
            <KeyRound size={16} style={{ color: "var(--cyan)" }} /> Rotation des comptes Serper.dev
          </h2>
          <span className="chip" style={{ color: "var(--cyan)", borderColor: "rgba(56,189,248,.3)" }}>Prospector</span>
        </div>
        <p className="text-[12.5px] mb-5 leading-relaxed" style={{ color: "var(--text-dim)" }}>
          Chaque compte serper.dev offre <b className="text-white">2500 requêtes gratuites</b>. Prospector consomme la clé active, détecte l'épuisement (HTTP 401/402/403/429 ou limite atteinte), la retire du parc et bascule instantanément sur la suivante — sans interrompre la mission. Quand tout le parc est à sec, RIO reçoit une alerte critique sur Telegram pour ajouter un nouveau compte ; la rotation reprend dès l'ajout.
        </p>

        <div className="flex gap-2.5 mb-5">
          <input className="input flex-1" placeholder="Collez une clé API serper.dev…" value={newKey} onChange={(e) => setNewKey(e.target.value)} type="password" />
          <button className="btn-primary" onClick={addSerperKey} disabled={addingKey || newKey.trim().length < 10}>
            {addingKey ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Ajouter
          </button>
        </div>

        {(data?.serperKeys ?? []).length === 0 ? (
          <p className="text-[12.5px]" style={{ color: "var(--amber)" }}>
            Aucune clé Serper — la prospection réelle est bloquée. Créez un compte gratuit sur{" "}
            <a href="https://serper.dev" target="_blank" rel="noopener" className="underline" style={{ color: "var(--cyan)" }}>serper.dev</a>{" "}
            et collez la clé ci-dessus. (Un « Mode test » existe dans Réglages pour la démonstration.)
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data!.serperKeys.map((k) => {
              const pct = Math.min(100, Math.round((k.creditsUsed / k.creditLimit) * 100));
              return (
                <div key={k.id} className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,.25)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold text-white">{k.label}</span>
                    <span className="chip" style={k.status === "active" ? { color: "var(--accent)", borderColor: "rgba(0,229,160,.3)" } : { color: "var(--red)", borderColor: "rgba(248,113,113,.35)" }}>
                      {k.status === "active" ? "ACTIVE" : "ÉPUISÉE"}{k.isProvisioned ? " · AUTO" : ""}
                    </span>
                  </div>
                  <div className="progress mb-2">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 85 ? "var(--red)" : "var(--cyan)" }} />
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10.5px]" style={{ color: "var(--text-faint)" }}>
                    <span>{k.creditsUsed} / {k.creditLimit} crédits ({pct}%)</span>
                    <button className="text-[10.5px] font-semibold hover:underline" style={{ color: "var(--red)" }} onClick={() => removeKey(k.id)}>Supprimer</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
