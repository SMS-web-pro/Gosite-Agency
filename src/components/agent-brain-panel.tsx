"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Dna, GraduationCap, Cog, Loader2, Plus, X, Sparkles, Activity } from "lucide-react";

type Skill = { id: number; title: string; instruction: string; source: string; active: boolean; useCount: number };
type Learning = { id: number; insight: string; kind: string; createdAt: string };
type AiStats = { calls: number; ok: number; avgLatency: number; tokens: number };

const SOURCE_META: Record<string, { icon: typeof Cog; label: string; color: string }> = {
  core: { icon: Cog, label: "Native", color: "#9aa4b2" },
  user: { icon: GraduationCap, label: "Enseignée", color: "#fbbf24" },
  learned: { icon: Dna, label: "Auto-apprise", color: "#00e5a0" },
};

export function AgentBrainPanel({ agentKey, agentName, color, brainOnline, onToast }: {
  agentKey: string; agentName: string; color: string; brainOnline: boolean;
  onToast: (msg: string, kind: "ok" | "err") => void;
}) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [ai, setAi] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agents/${agentKey}/skills`, { cache: "no-store" });
      const j = await r.json();
      setSkills(j.skills ?? []);
      setLearnings(j.learnings ?? []);
      setAi(j.ai ?? null);
    } finally { setLoading(false); }
  }, [agentKey]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const teach = async () => {
    if (!title.trim() || !instruction.trim()) return;
    await fetch(`/api/agents/${agentKey}/skills`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, instruction }),
    });
    setTitle(""); setInstruction(""); setShowForm(false);
    onToast(`Compétence enseignée à ${agentName}.`, "ok");
    load();
  };

  const toggle = async (s: Skill) => {
    await fetch(`/api/agents/${agentKey}/skills`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id, active: !s.active }),
    });
    load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/agents/${agentKey}/skills?id=${id}`, { method: "DELETE" });
    load();
  };

  const evolve = async () => {
    setEvolving(true);
    try {
      const r = await fetch(`/api/agents/${agentKey}/evolve`, { method: "POST" });
      const j = await r.json();
      onToast(j.ok ? `${agentName} a évolué — ${j.summary}` : j.summary, j.ok ? "ok" : "err");
      load();
    } finally { setEvolving(false); }
  };

  const activeCount = skills.filter((s) => s.active).length;

  return (
    <div className="mt-1 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
      <button
        className="w-full flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0 text-left"
        onClick={() => setOpen(!open)}
      >
        <Brain size={13} style={{ color: brainOnline ? color : "var(--text-faint)" }} />
        <span className="text-[11.5px] font-semibold" style={{ color: brainOnline ? "var(--text)" : "var(--text-faint)" }}>
          Cerveau IA {brainOnline ? "" : "(hors-ligne)"}
        </span>
        {open && skills.length > 0 && (
          <span className="chip font-mono" style={{ fontSize: 9, color: "var(--text-faint)" }}>{activeCount} skills</span>
        )}
        <span className="ml-auto text-[10.5px]" style={{ color: "var(--text-faint)" }}>{open ? "masquer" : "ouvrir"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {/* AI usage */}
          {ai && ai.calls > 0 && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-[10.5px] font-mono"
              style={{ background: "rgba(0,0,0,.3)", border: "1px solid var(--border)", color: "var(--text-dim)" }}>
              <Activity size={11} style={{ color }} />
              {ai.calls} appels IA · {Math.round((ai.ok / Math.max(1, ai.calls)) * 100)}% ok · {ai.avgLatency}ms moy.
              {ai.tokens > 0 && ` · ${ai.tokens.toLocaleString("fr-FR")} tokens`}
            </div>
          )}

          {/* Skills */}
          {loading ? (
            <div className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>Chargement du cerveau…</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {skills.map((s) => {
                const meta = SOURCE_META[s.source] ?? SOURCE_META.user;
                return (
                  <div key={s.id} className="group px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,.26)", border: "1px solid var(--border)", opacity: s.active ? 1 : 0.5 }}>
                    <div className="flex items-start gap-2">
                      <meta.icon size={11} className="mt-0.5 flex-shrink-0" style={{ color: meta.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11.5px] font-semibold text-white">{s.title}</div>
                        <div className="text-[10.5px] mt-0.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>{s.instruction}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => toggle(s)} className="bg-transparent border-0 cursor-pointer text-[9.5px] font-semibold"
                          style={{ color: s.active ? "var(--amber)" : "var(--accent)" }}>
                          {s.active ? "off" : "on"}
                        </button>
                        {s.source !== "core" && (
                          <button onClick={() => remove(s.id)} className="bg-transparent border-0 cursor-pointer opacity-0 group-hover:opacity-100" style={{ color: "var(--red)" }}>
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Teach form */}
          {showForm ? (
            <div className="flex flex-col gap-2 p-3 rounded-lg" style={{ background: "rgba(0,0,0,.3)", border: "1px solid rgba(251,191,36,.25)" }}>
              <input className="input !text-[11.5px] !py-2" placeholder="Intitulé (ex. Objet accrocheur)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input !text-[11.5px] !py-2" rows={3} placeholder="Consigne opérationnelle, à la 2e personne (ex. « Garde un objet sous 45 caractères avec le nom du commerce »)"
                value={instruction} onChange={(e) => setInstruction(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary !py-1.5 !px-3 !text-[11px]" onClick={teach}><GraduationCap size={11} /> Enseigner</button>
                <button className="btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={() => setShowForm(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button className="btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={() => setShowForm(true)}>
                <Plus size={11} /> Enseigner une compétence
              </button>
              <button className="btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={evolve} disabled={evolving || !brainOnline}
                style={{ color: "var(--accent)", borderColor: "rgba(0,229,160,.25)" }}>
                {evolving ? <Loader2 size={11} className="animate-spin" /> : <Dna size={11} />} Faire évoluer
              </button>
            </div>
          )}

          {/* Learnings */}
          {learnings.length > 0 && (
            <div>
              <div className="label-xs mb-1.5 flex items-center gap-1.5"><Sparkles size={10} /> Appris sur le terrain</div>
              <div className="flex flex-col gap-1">
                {learnings.slice(0, 4).map((l) => (
                  <div key={l.id} className="text-[10.5px] leading-relaxed pl-3" style={{ color: "var(--text-dim)", borderLeft: `2px solid ${color}44` }}>
                    {l.insight}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
