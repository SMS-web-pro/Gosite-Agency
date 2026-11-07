"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Radar, Search, Users, MonitorSmartphone, Rocket, MailCheck,
  ChevronRight, Play, Loader2, Radio, CircleDollarSign, Bot, Triangle,
  CreditCard, Send as SendIcon, KeyRound, AlertTriangle, CheckCircle2, Clock, Plus, Trash2, CalendarClock,
  MessagesSquare,
} from "lucide-react";
import { useApi, CountUp, Toast, AGENT_ICONS, STAGE_LABELS, stageChipStyle, apiJson } from "@/components/ui";

/* ── Shared types ── */
export type AgentRow = {
  id: number; key: string; name: string; roleTitle: string; description: string;
  icon: string; color: string; status: string; isLive: boolean; autoPilot: boolean;
  stats: { runs: number; successes: number; failures: number }; lastRunAt: string | null; lastError: string | null;
};
export type ProspectRow = {
  id: number; businessName: string; businessType: string; phone: string | null; email: string | null;
  emailStatus: string; city: string | null; country: string | null; rating: string | null;
  reviewCount: number | null; hasWebsite: boolean; stage: string; rejectReason: string | null;
  deployedUrl: string | null; deployStatus: string; paymentStatus: string; source: string;
  searchQuery: string | null; createdAt: string; hasSite: boolean; contacteAt?: string | null;
  aiScore?: number | null; aiInsight?: string | null;
};
export type ActivityRow = {
  id: number; agentKey: string; action: string; message: string; level: string;
  prospectId: number | null; createdAt: string;
};
export type ScheduleRow = {
  id: number; niche: string; city: string; intervalHours: number; maxResults: number;
  active: boolean; lastRunAt: string | null; createdAt: string;
};
export type StatsPayload = {
  agents: AgentRow[];
  prospects: ProspectRow[];
  activity: ActivityRow[];
  serperKeys: { id: number; label: string; creditLimit: number; creditsUsed: number; status: string; isProvisioned: boolean }[];
  stageCounts: Record<string, number>;
  kpis: { totalLeads: number; qualified: number; sitesBuilt: number; deployed: number; contacted: number; paid: number; rejected: number; creditsUsed: number; creditsTotal: number };
  integrations: Record<string, boolean>;
  allowSimulation: boolean;
  autopilot: boolean;
  schedules: ScheduleRow[];
};

const NICHES = ["barbershop", "restaurant", "plombier", "dentiste", "salle de sport", "spa & beauté", "électricien", "boulangerie", "garage auto", "avocat", "coiffeur", "restaurant marocain"];
const CITIES = ["Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir", "Paris", "Lyon", "Marseille", "Toulouse", "Bruxelles"];

const INTEG_LABELS: Record<string, { name: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; where: string }> = {
  telegram: { name: "Telegram Bot", icon: SendIcon, where: "/settings" },
  serper: { name: "Serper.dev (Prospector)", icon: KeyRound, where: "/agents" },
  llm: { name: "LLM omniroute (Coder)", icon: Bot, where: "/settings" },
  vercel: { name: "Vercel (Deployer)", icon: Triangle, where: "/settings" },
  brevo: { name: "Brevo (Saler)", icon: MailCheck, where: "/settings" },
  whop: { name: "Whop (Paymer)", icon: CreditCard, where: "/settings" },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `il y a ${s}s`;
  if (s < 3600) return `il y a ${Math.floor(s / 60)}min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)}j`;
}

export default function Dashboard() {
  const { data, reload } = useApi<StatsPayload>("/api/stats", 5000);
  const [niche, setNiche] = useState("barbershop");
  const [city, setCity] = useState("Casablanca");
  const [strategy, setStrategy] = useState<"swarm" | "precise">("swarm");
  const [lastMission, setLastMission] = useState<{ queries?: { query: string; found: number; kept: number }[]; creditsSpent?: number; reasoning?: string } | null>(null);
  const [schedNiche, setSchedNiche] = useState("restaurant");
  const [schedCity, setSchedCity] = useState("Marrakech");
  const [schedEvery, setSchedEvery] = useState(6);
  const [launching, setLaunching] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const boosterRef = useRef(false);

  // Booster auto-pilote : tant que la console est ouverte, un cycle part toutes les 5 min.
  useEffect(() => {
    if (!data?.autopilot) return;
    if (boosterRef.current) return;
    boosterRef.current = true;
    const t = setInterval(() => {
      fetch("/api/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tick" }) }).catch(() => {});
    }, 300_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.autopilot]);

  const launchMission = async () => {
    setLaunching(true);
    setLastMission(null);
    try {
      const r = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche, city, strategy, autoValidate: true, telegram: true }),
      });
      const j = await apiJson<{ ok?: boolean; inserted?: number; duplicates?: number; creditsSpent?: number; rotated?: boolean; validation?: { validated: number; rejected: number }; error?: string }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — réessaie.", kind: "err" }); return; }
      if (j.ok) {
        setLastMission(j);
        setToast({
          msg: `${j.inserted} leads importés · ${j.duplicates} doublons · ${j.creditsSpent ?? "?"} crédit(s)${j.validation ? ` · ${j.validation.validated} qualifiés, ${j.validation.rejected} rejetés` : ""}${j.rotated ? " · rotation de compte Serper" : ""}`,
          kind: "ok",
        });
      } else setToast({ msg: j.error ?? "Mission bloquée", kind: "err" });
      await reload();
    } finally {
      setLaunching(false);
    }
  };

  const tickNow = async () => {
    setTicking(true);
    try {
      const r = await fetch("/api/autopilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "tick" }) });
      const j = await apiJson<{ advanced?: Record<string, number>; missionsRun?: number; errors?: string[] }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — réessaie.", kind: "err" }); return; }
      const moved = Object.values(j.advanced ?? {}).reduce((a: number, b) => a + (b as number), 0);
      setToast({ msg: `Cycle terminé : ${j.missionsRun} mission(s), ${moved} lead(s) avancé(s)${j.errors?.length ? `, ${j.errors.length} erreur(s)` : ""}.`, kind: j.errors?.length && !moved ? "err" : "ok" });
      await reload();
    } finally {
      setTicking(false);
    }
  };

  const toggleAutopilot = async () => {
    await fetch("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ AUTOPILOT: data?.autopilot ? "false" : "true" }),
    });
    await reload();
  };

  const addSchedule = async () => {
    const r = await fetch("/api/schedules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ niche: schedNiche, city: schedCity, intervalHours: schedEvery }),
    });
    const j = await apiJson<{ ok?: boolean; error?: string }>(r);
    if (!j || !j.ok) { setToast({ msg: j?.error ?? "Planification impossible — réessaie.", kind: "err" }); return; }
    setToast({ msg: `Mission planifiée : ${schedNiche} / ${schedCity} toutes les ${schedEvery}h.`, kind: "ok" });
    await reload();
  };

  const removeSchedule = async (id: number) => {
    await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    await reload();
  };

  const toggleSchedule = async (id: number, active: boolean) => {
    await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }) });
    await reload();
  };

  const k = data?.kpis;
  const stageEntries = ["discovered", "validated", "email_verified", "mapped", "site_built", "deployed", "contacted", "paid", "domain_linked"];
  const maxStage = Math.max(1, ...stageEntries.map((s) => data?.stageCounts[s] ?? 0));
  const missing = data ? Object.entries(INTEG_LABELS).filter(([key]) => !data.integrations[key]) : [];
  const prodReady = data ? missing.length === 0 : false;

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-[26px] text-white leading-tight">
            Mission Control<span className="glow-accent" style={{ color: "var(--accent)" }}>.</span>
          </h1>
          <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
            Bonjour RIO — agence pilotée ici ou sur Telegram, en continu.{" "}
            {data && (prodReady
              ? <span style={{ color: "var(--accent)" }}>Toutes les intégrations sont LIVE.</span>
              : <span style={{ color: "var(--amber)" }}>{missing.length} intégration(s) à connecter pour le 100% LIVE.</span>)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/rio" className="btn-primary !py-2"><MessagesSquare size={13} /> Parler à RIO</Link>
          <span className="chip font-mono" style={data?.autopilot ? { color: "var(--accent)", borderColor: "rgba(0,229,160,.35)", background: "var(--accent-dim)" } : { color: "var(--amber)", borderColor: "rgba(251,191,36,.35)" }}>
            <Radio size={11} /> AUTO-PILOTE {data?.autopilot ? "ACTIF 24/7" : "PAUSE"}
          </span>
        </div>
      </div>

      {/* Production readiness banner */}
      {data && !prodReady && (
        <div className="card p-5" style={{ borderColor: "rgba(251,191,36,.3)", background: "rgba(251,191,36,.045)" }}>
          <div className="flex items-center gap-2.5 mb-3">
            <AlertTriangle size={16} style={{ color: "var(--amber)" }} />
            <span className="font-display font-bold text-[14.5px]" style={{ color: "var(--amber)" }}>
              {data.allowSimulation ? "Mode test partiellement actif — connectez les vraies APIs pour la production" : "Configuration requise pour le 100% production"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {missing.map(([key, meta]) => (
              <Link key={key} href={meta.where} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl no-underline" style={{ background: "rgba(0,0,0,.3)", border: "1px solid var(--border)" }}>
                <meta.icon size={14} style={{ color: "var(--amber)" }} />
                <span className="text-[12.5px] font-medium text-white">{meta.name}</span>
                <ChevronRight size={12} className="ml-auto" style={{ color: "var(--text-faint)" }} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {[
          { label: "Leads découverts", value: k?.totalLeads ?? 0, icon: Search, color: "#38bdf8", href: "/pipeline" },
          { label: "Qualifiés GMB", value: k?.qualified ?? 0, icon: Users, color: "#34d399", href: "/pipeline" },
          { label: "Sites générés", value: k?.sitesBuilt ?? 0, icon: MonitorSmartphone, color: "#f472b6", href: "/pipeline?stage=site_built" },
          { label: "En ligne", value: k?.deployed ?? 0, icon: Rocket, color: "#60a5fa", href: "/pipeline?stage=deployed" },
          { label: "Offres envoyées", value: k?.contacted ?? 0, icon: MailCheck, color: "#fb923c", href: "/pipeline?stage=contacted" },
          { label: "Payés", value: k?.paid ?? 0, icon: CircleDollarSign, color: "#00e5a0", href: "/pipeline?stage=paid" },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="card card-hover p-4 no-underline group">
            <div className="flex items-center justify-between mb-3">
              <c.icon size={17} style={{ color: c.color }} />
              <ChevronRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-faint)" }} />
            </div>
            <div className="font-display font-bold text-[26px] leading-none text-white"><CountUp value={c.value} /></div>
            <div className="text-[11px] mt-2 font-medium" style={{ color: "var(--text-dim)" }}>{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Mission launcher + autopilot */}
        <div className="xl:col-span-2 card p-6 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-20 blur-3xl" style={{ background: "var(--cyan)" }} />
          <div className="flex items-center gap-4 mb-5">
            <div className="radar flex-shrink-0" />
            <div>
              <div className="label-xs mb-1">Prospector · Moteur Serper.dev</div>
              <h2 className="font-display font-bold text-[18px] text-white leading-snug">Lancer une mission de prospection</h2>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="label-xs block mb-1.5">Niche ciblée</label>
              <select className="select-input" value={niche} onChange={(e) => setNiche(e.target.value)}>
                {NICHES.map((n) => <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="label-xs block mb-1.5">Ville</label>
              <input className="input" list="cities" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex. Casablanca" />
              <datalist id="cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>

            {/* Stratégie de prospection */}
            <div>
              <label className="label-xs block mb-1.5">Stratégie</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "swarm" as const, title: "Essaim intelligent", desc: "3-5 requêtes IA (métier × quartiers) · 30-60 fiches · recommandé" },
                  { key: "precise" as const, title: "Requête précise", desc: "1 requête optimisée · ~10-20 fiches · économise les crédits" },
                ]).map((s) => (
                  <button key={s.key} type="button" onClick={() => setStrategy(s.key)}
                    className="text-left p-3 rounded-xl border transition-all"
                    style={{
                      borderColor: strategy === s.key ? "rgba(0,229,160,.45)" : "var(--border)",
                      background: strategy === s.key ? "var(--accent-dim)" : "rgba(0,0,0,.22)",
                    }}>
                    <div className="text-[12px] font-bold" style={{ color: strategy === s.key ? "var(--accent)" : "var(--text)" }}>{s.title}</div>
                    <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: "var(--text-faint)" }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary justify-center !py-3 !text-[13.5px] mt-1" onClick={launchMission} disabled={launching || !city.trim()}>
              {launching ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {launching ? "Prospector en mission…" : `Déployer Prospector + Validator ${strategy === "swarm" ? "(essaim)" : ""}`}
            </button>

            {/* Rendement par requête de la dernière mission */}
            {lastMission?.queries && lastMission.queries.length > 0 && (
              <div className="p-3.5 rounded-xl" style={{ background: "rgba(0,0,0,.28)", border: "1px solid var(--border)" }}>
                <div className="label-xs mb-2">Rendement de l'essaim{lastMission.creditsSpent ? ` · ${lastMission.creditsSpent} crédits` : ""}</div>
                {lastMission.reasoning && (
                  <p className="text-[11px] mb-2 leading-relaxed" style={{ color: "var(--violet)" }}>🧠 {lastMission.reasoning}</p>
                )}
                <div className="flex flex-col gap-1.5">
                  {lastMission.queries.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-dim)" }}>
                      <span className="dot flex-shrink-0" style={{ width: 6, height: 6, background: q.found >= 8 ? "var(--accent)" : q.found > 0 ? "var(--amber)" : "var(--red)", boxShadow: "none", animation: "none" }} />
                      <span className="truncate flex-1" title={q.query}>{q.query}</span>
                      <span className="font-mono flex-shrink-0">{q.kept} uniques / {q.found}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Auto-pilote */}
          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="label-xs flex items-center gap-1.5"><Bot size={11} /> Auto-pilote 24/7</span>
              <div className="flex items-center gap-2.5">
                <button type="button" className={`switch ${data?.autopilot ? "on" : ""}`} onClick={toggleAutopilot} aria-label="auto-pilote" />
                <button className="btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={tickNow} disabled={ticking}>
                  {ticking ? <Loader2 size={12} className="animate-spin" /> : <Radio size={12} />} Cycle maintenant
                </button>
              </div>
            </div>
            <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "var(--text-faint)" }}>
              Cron Vercel toutes les heures (<code>/api/cron/tick</code>) + booster console toutes les 5 min + commande Telegram <code>/tick</code>. En production, chaque cycle : missions planifiées → qualification → vérif emails → fiches → sites → déploiements → offres.
            </p>

            {/* Missions planifiées */}
            <div className="label-xs mb-2 flex items-center gap-1.5"><CalendarClock size={11} /> Missions récurrentes</div>
            <div className="flex gap-2 mb-3">
              <select className="select-input" value={schedNiche} onChange={(e) => setSchedNiche(e.target.value)}>
                {NICHES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className="input" value={schedCity} onChange={(e) => setSchedCity(e.target.value)} placeholder="Ville" style={{ maxWidth: 130 }} />
            </div>
            <div className="flex gap-2 mb-3">
              <select className="select-input" value={schedEvery} onChange={(e) => setSchedEvery(Number(e.target.value))}>
                {[2, 4, 6, 12, 24].map((h) => <option key={h} value={h}>Toutes les {h}h</option>)}
              </select>
              <button className="btn-primary !py-2" onClick={addSchedule}><Plus size={13} /> Planifier</button>
            </div>
            {(data?.schedules ?? []).length > 0 && (
              <div className="flex flex-col gap-1.5">
                {data!.schedules.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px]" style={{ background: "rgba(0,0,0,.28)", border: "1px solid var(--border)" }}>
                    <span className="dot" style={{ width: 6, height: 6, background: s.active ? "var(--accent)" : "var(--text-faint)", boxShadow: "none", animation: "none" }} />
                    <span className="text-white font-medium capitalize">{s.niche} · {s.city}</span>
                    <span className="font-mono text-[10px]" style={{ color: "var(--text-faint)" }}>
                      /{s.intervalHours}h{s.lastRunAt ? ` · ${timeAgo(s.lastRunAt)}` : " · jamais"}
                    </span>
                    <button className="ml-auto text-[10.5px] font-semibold hover:underline" style={{ color: s.active ? "var(--amber)" : "var(--accent)" }} onClick={() => toggleSchedule(s.id, !s.active)}>
                      {s.active ? "Suspendre" : "Activer"}
                    </button>
                    <button onClick={() => removeSchedule(s.id)} style={{ color: "var(--text-faint)" }} className="bg-transparent border-0 cursor-pointer hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Serper credits */}
          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="label-xs">Crédits Serper (2500/compte)</span>
              <Link href="/agents" className="text-[11px] font-semibold no-underline" style={{ color: "var(--accent)" }}>Rotation & clés →</Link>
            </div>
            {(data?.serperKeys?.length ?? 0) === 0 ? (
              <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--amber)" }}>
                Aucune clé Serper — ajoutez-en une pour activer la prospection réelle (compte gratuit : 2500 requêtes).
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data!.serperKeys.slice(0, 3).map((k2) => {
                  const pct = Math.min(100, (k2.creditsUsed / k2.creditLimit) * 100);
                  return (
                    <div key={k2.id}>
                      <div className="flex justify-between text-[11px] mb-1 font-mono" style={{ color: "var(--text-dim)" }}>
                        <span>{k2.label}{k2.isProvisioned ? " · auto" : ""}</span>
                        <span>{k2.creditsUsed}/{k2.creditLimit}{k2.status === "exhausted" ? " · épuisé" : ""}</span>
                      </div>
                      <div className="progress">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct > 85 ? "var(--red)" : pct > 60 ? "var(--amber)" : "var(--accent)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Funnel */}
        <div className="xl:col-span-3 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="label-xs mb-1">Pipeline de conversion</div>
              <h2 className="font-display font-bold text-[18px] text-white">De la prospection au paiement</h2>
            </div>
            <CheckCircle2 size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div className="flex flex-col gap-3">
            {stageEntries.map((s) => {
              const count = data?.stageCounts[s] ?? 0;
              const pct = Math.round((count / maxStage) * 100);
              return (
                <Link key={s} href={`/pipeline?stage=${s}`} className="no-underline group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-medium flex items-center gap-2" style={{ color: "var(--text-dim)" }}>
                      <span className="chip stage-chip" style={stageChipStyle(s)}>{STAGE_LABELS[s]}</span>
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-white"><CountUp value={count} duration={800} /></span>
                  </div>
                  <div className="funnel-bar">
                    <div className="funnel-fill" style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              ⛔ {k?.rejected ?? 0} leads rejetés par Validator (⭐≥4,0 · ≥10 avis · sans site web · email valide)
            </span>
            <Link href="/pipeline" className="btn-ghost !py-2">Ouvrir le pipeline <ChevronRight size={13} /></Link>
          </div>
        </div>
      </div>

      {/* Activity + Agents */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-[17px] text-white flex items-center gap-2">
              <span className="dot dot-running" /> Journal d'opérations
            </h2>
            <span className="font-mono text-[10.5px]" style={{ color: "var(--text-faint)" }}>{data?.activity.length ?? 0} événements</span>
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 420 }}>
            {(data?.activity ?? []).length === 0 && (
              <p className="text-[13px] py-8 text-center" style={{ color: "var(--text-faint)" }}>
                Aucune activité. Lancez une mission de prospection pour réveiller l'équipe.
              </p>
            )}
            {(data?.activity ?? []).map((a) => {
              const Icon = AGENT_ICONS[a.agentKey] ?? Radar;
              const color = a.level === "success" ? "var(--accent)" : a.level === "warn" ? "var(--amber)" : a.level === "error" ? "var(--red)" : "var(--cyan)";
              return (
                <div key={a.id} className="feed-line">
                  <div className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full flex items-center justify-center" style={{ background: `${color}` + "22", border: `1px solid ${color}55` }}>
                    <Icon size={8} style={{ color }} />
                  </div>
                  <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--text)" }}>
                    {a.prospectId ? (
                      <Link href={`/prospects/${a.prospectId}`} className="no-underline hover:underline" style={{ color: "inherit" }}>{a.message}</Link>
                    ) : a.message}
                  </div>
                  <div className="font-mono text-[10px] mt-1" style={{ color: "var(--text-faint)" }}>
                    {a.agentKey.toUpperCase()} · {a.action} · {timeAgo(a.createdAt)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-[17px] text-white">L'équipe — 10 agents</h2>
            <Link href="/agents" className="text-[11.5px] font-semibold no-underline" style={{ color: "var(--accent)" }}>Gérer →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(data?.agents ?? []).map((a) => {
              const Icon = AGENT_ICONS[a.key] ?? Radar;
              return (
                <Link key={a.key} href="/agents" className="flex items-center gap-3 p-3 rounded-xl no-underline border transition-all hover:-translate-y-0.5"
                  style={{ borderColor: "var(--border)", background: "rgba(255,255,255,.02)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: a.color + "16", border: `1px solid ${a.color}33` }}>
                    <Icon size={15} style={{ color: a.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-white truncate">{a.name}</div>
                    <div className="text-[10.5px] truncate" style={{ color: "var(--text-faint)" }}>{a.roleTitle}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`dot dot-${a.status}`} style={{ width: 7, height: 7 }} />
                    <span className="font-mono text-[9px]" style={{ color: "var(--text-faint)" }}>{a.stats?.runs ?? 0} runs</span>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t flex items-center gap-2 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
            <Clock size={11} /> Chaque agent journalise ses actions, expose ses métriques et rapporte ses erreurs à RIO sur Telegram.
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
