"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Send, Loader2, Crown, Trash2, Wrench, Sparkles, Target, Plus, X,
  BrainCircuit, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Toast, useApi, apiJson } from "@/components/ui";
import { markdownToHtml } from "@/lib/format";

type Msg = {
  id: number | string;
  role: string;
  content: string;
  toolCalls?: { name: string; args: Record<string, unknown>; result?: string }[] | null;
  createdAt?: string;
  pending?: boolean;
};

type ObjectiveRow = { id: number; title: string; metric: string; target: number; status: string; progress: number };

const SUGGESTIONS = [
  "Où en est le pipeline aujourd'hui ?",
  "Prospecte des barbershops à Casablanca",
  "Quel est mon goulot d'étranglement ?",
  "Supprime tous les leads rejetés",
  "Pourquoi les emails sont rejetés ?",
  "Lance un cycle auto-pilote",
  "Montre-moi les dernières erreurs",
  "Qu'est-ce qu'il me reste à configurer ?",
];

export default function RioChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [objectives, setObjectives] = useState<ObjectiveRow[]>([]);
  const [showObjForm, setShowObjForm] = useState(false);
  const [objTitle, setObjTitle] = useState("");
  const [objMetric, setObjMetric] = useState("paid");
  const [objTarget, setObjTarget] = useState(10);
  const endRef = useRef<HTMLDivElement>(null);
  const { data: diag } = useApi<{ score: number; productionReady: boolean; blocking: string[] }>("/api/diagnostics", 30000);

  const loadHistory = async () => {
    const r = await fetch("/api/rio/chat");
    const j = await apiJson<{ messages?: Msg[] }>(r);
    if (j) setMessages((j.messages ?? []).filter((m: Msg) => m.role !== "tool"));
  };
  const loadObjectives = async () => {
    const r = await fetch("/api/objectives");
    const j = await apiJson<{ objectives?: ObjectiveRow[] }>(r);
    if (j) setObjectives((j.objectives ?? []).filter((o: ObjectiveRow) => o.status === "active"));
  };

  useEffect(() => { loadHistory(); loadObjectives(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput("");
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: message }]);
    setBusy(true);
    try {
      const r = await fetch("/api/rio/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      });
      const j = await apiJson<{ reply?: string; engine?: string; toolCalls?: { name: string; args: Record<string, unknown>; result?: string }[] }>(r);
      if (!j) {
        setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: "Connexion interrompue. Réessaie." }]);
        return;
      }
      setMessages((m) => [...m, {
        id: `a-${Date.now()}`, role: "assistant", content: j.reply ?? "…",
        toolCalls: j.toolCalls ?? [],
      }]);
      if (j.engine === "rules") {
        setToast({ msg: "RIO répond en mode réflexes — configurez le LLM omniroute pour le raisonnement complet.", kind: "err" });
      }
      loadObjectives();
    } catch {
      setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", content: "Connexion interrompue. Réessaie." }]);
    } finally {
      setBusy(false);
    }
  };

  const clearChat = async () => {
    await fetch("/api/rio/chat", { method: "DELETE" });
    setMessages([]);
    setToast({ msg: "Mémoire de conversation effacée.", kind: "ok" });
  };

  const addObjective = async () => {
    if (!objTitle.trim()) return;
    await fetch("/api/objectives", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: objTitle, metric: objMetric, target: objTarget }),
    });
    setObjTitle(""); setShowObjForm(false);
    loadObjectives();
    setToast({ msg: "Objectif enregistré — RIO le suivra.", kind: "ok" });
  };

  const removeObjective = async (id: number) => {
    await fetch(`/api/objectives?id=${id}`, { method: "DELETE" });
    loadObjectives();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
      {/* ── Chat ── */}
      <div className="card flex flex-col overflow-hidden" style={{ height: "calc(100vh - 150px)", minHeight: 520 }}>
        {/* Header */}
        <div className="flex items-center gap-3.5 px-5 py-4 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#00e5a0,#38bdf8)", color: "#05281c" }}>R</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-display font-bold text-[15.5px] text-white">
              RIO <Crown size={12} style={{ color: "var(--amber)" }} />
              <span className="dot dot-ready ml-1" />
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              CEO · dirige les 10 agents · accès complet aux données et aux actions
            </div>
          </div>
          <button className="btn-ghost !py-1.5 !px-3 !text-[11px] ml-auto" onClick={clearChat}>
            <Trash2 size={11} /> Effacer
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--accent-dim)", border: "1px solid rgba(0,229,160,.25)" }}>
                <BrainCircuit size={24} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h2 className="font-display font-bold text-[18px] text-white mb-1.5">Parle-moi, je m'occupe du reste.</h2>
                <p className="text-[13px] max-w-md leading-relaxed" style={{ color: "var(--text-dim)" }}>
                  Je lis les données réelles de l'agence et j'exécute de vraies actions : prospection, qualification,
                  génération de sites, déploiements, suppressions, objectifs, diagnostics.
                </p>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                style={m.role === "user"
                  ? { background: "rgba(255,255,255,.08)", color: "var(--text-dim)", border: "1px solid var(--border)" }
                  : { background: "linear-gradient(135deg,#00e5a0,#38bdf8)", color: "#05281c" }}>
                {m.role === "user" ? "Moi" : "R"}
              </div>
              <div className={`max-w-[78%] ${m.role === "user" ? "items-end" : ""} flex flex-col gap-1.5`}>
                <div className="px-4 py-3 rounded-2xl text-[13.5px] leading-relaxed whitespace-pre-wrap"
                  style={m.role === "user"
                    ? { background: "rgba(255,255,255,.055)", border: "1px solid var(--border)", color: "var(--text)", borderBottomRightRadius: 6 }
                    : { background: "rgba(0,229,160,.055)", border: "1px solid rgba(0,229,160,.18)", color: "var(--text)", borderBottomLeftRadius: 6 }}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(m.content) }}
                />
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.toolCalls.map((t, i) => (
                      <span key={i} className="chip font-mono" style={{ color: "var(--cyan)", borderColor: "rgba(56,189,248,.28)", background: "rgba(56,189,248,.07)", fontSize: 10 }}
                        title={t.result ?? ""}>
                        <Wrench size={9} /> {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                style={{ background: "linear-gradient(135deg,#00e5a0,#38bdf8)", color: "#05281c" }}>R</div>
              <div className="px-4 py-3 rounded-2xl flex items-center gap-2.5" style={{ background: "rgba(0,229,160,.055)", border: "1px solid rgba(0,229,160,.18)", borderBottomLeftRadius: 6 }}>
                <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)" }} />
                <span className="text-[12.5px]" style={{ color: "var(--text-dim)" }}>RIO consulte les données et agit…</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2 flex-shrink-0">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="btn-ghost !py-1.5 !px-3 !text-[11.5px]" onClick={() => send(s)} disabled={busy}>
                <Sparkles size={10} style={{ color: "var(--accent)" }} /> {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-5 py-4 border-t flex gap-2.5 flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <input
            className="input flex-1"
            placeholder="Donne un ordre, pose une question, fixe un objectif…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={busy}
          />
          <button className="btn-primary" onClick={() => send()} disabled={busy || !input.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {/* ── Side panel ── */}
      <div className="flex flex-col gap-4">
        {/* Readiness */}
        <div className="card p-5">
          <div className="label-xs mb-3">État de production</div>
          <div className="flex items-center gap-3 mb-3">
            <div className="font-display font-bold text-[30px] leading-none" style={{ color: diag && diag.score >= 80 ? "var(--accent)" : diag && diag.score >= 50 ? "var(--amber)" : "var(--red)" }}>
              {diag?.score ?? "—"}%
            </div>
            <div className="text-[11.5px] leading-tight" style={{ color: "var(--text-dim)" }}>
              {diag?.productionReady ? "Prêt pour la production" : "Configuration incomplète"}
            </div>
          </div>
          <div className="progress mb-3">
            <div className="progress-fill" style={{ width: `${diag?.score ?? 0}%`, background: diag && diag.score >= 80 ? "var(--accent)" : "var(--amber)" }} />
          </div>
          {diag && diag.blocking.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {diag.blocking.map((b) => (
                <div key={b} className="flex items-start gap-2 text-[11.5px]" style={{ color: "var(--amber)" }}>
                  <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {b}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--accent)" }}>
              <CheckCircle2 size={12} /> Aucun blocage critique
            </div>
          )}
          <Link href="/settings" className="btn-ghost w-full justify-center !py-2 !text-[11.5px] mt-3">Ouvrir l'assistant</Link>
        </div>

        {/* Objectives */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="label-xs flex items-center gap-1.5"><Target size={11} /> Objectifs</div>
            <button className="bg-transparent border-0 cursor-pointer" style={{ color: "var(--accent)" }} onClick={() => setShowObjForm(!showObjForm)}>
              {showObjForm ? <X size={14} /> : <Plus size={14} />}
            </button>
          </div>

          {showObjForm && (
            <div className="flex flex-col gap-2 mb-3 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
              <input className="input !text-[12px]" placeholder="Ex. 10 clients payants ce mois" value={objTitle} onChange={(e) => setObjTitle(e.target.value)} />
              <div className="flex gap-2">
                <select className="select-input !text-[12px]" value={objMetric} onChange={(e) => setObjMetric(e.target.value)}>
                  <option value="paid">Payés</option>
                  <option value="contacted">Contactés</option>
                  <option value="deployed">Déployés</option>
                  <option value="qualified">Qualifiés</option>
                  <option value="leads">Leads</option>
                </select>
                <input className="input !text-[12px]" type="number" value={objTarget} onChange={(e) => setObjTarget(Number(e.target.value))} style={{ maxWidth: 76 }} />
              </div>
              <button className="btn-primary justify-center !py-2 !text-[12px]" onClick={addObjective}>Fixer l'objectif</button>
            </div>
          )}

          {objectives.length === 0 ? (
            <p className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              Aucun objectif. Dis à RIO « objectif : 10 clients payants » ou utilise le +.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {objectives.map((o) => {
                const pct = Math.min(100, Math.round((o.progress / o.target) * 100));
                return (
                  <div key={o.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium text-white truncate">{o.title}</span>
                      <button onClick={() => removeObjective(o.id)} className="bg-transparent border-0 cursor-pointer flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                        <X size={11} />
                      </button>
                    </div>
                    <div className="progress mb-1">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--accent)" : "var(--cyan)" }} />
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: "var(--text-faint)" }}>
                      {o.progress}/{o.target} {o.metric} · {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Capabilities */}
        <div className="card p-5">
          <div className="label-xs mb-3">Ce que RIO peut faire</div>
          <div className="flex flex-col gap-2 text-[11.5px]" style={{ color: "var(--text-dim)" }}>
            {[
              "Lire le pipeline et les KPIs en temps réel",
              "Lancer une prospection ciblée",
              "Qualifier, générer, déployer, envoyer l'offre",
              "Afficher et supprimer des leads",
              "Planifier des missions récurrentes",
              "Piloter l'auto-pilote et les agents",
              "Fixer et suivre des objectifs",
              "Diagnostiquer la configuration et les erreurs",
            ].map((c) => (
              <div key={c} className="flex items-start gap-2">
                <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} /> {c}
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}
