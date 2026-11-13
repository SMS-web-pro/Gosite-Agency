"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, StepForward, Zap, Trash2, ExternalLink, ChevronRight, Ban, Search, Download, Eraser, MessagesSquare } from "lucide-react";
import { useApi, Toast, Stars, STAGE_LABELS, STAGE_COLORS, stageChipStyle, apiJson } from "@/components/ui";
import type { StatsPayload, ProspectRow } from "@/app/page";

const BOARD_COLS = [
  "discovered", "validated", "email_verified", "mapped",
  "site_built", "deployed", "contacted", "paid", "domain_linked", "rejected",
];

const NEXT_ACTION: Record<string, { action: string; label: string }> = {
  discovered: { action: "validate", label: "Qualifier" },
  validated: { action: "verify", label: "Vérifier email" },
  email_verified: { action: "map", label: "Fiche client" },
  mapped: { action: "build", label: "Générer site" },
  site_built: { action: "deploy", label: "Déployer" },
  deployed: { action: "contact", label: "Envoyer offre" },
  contacted: { action: "payment", label: "Lien paiement" },
  paid: { action: "domain", label: "Lier domaine" },
};

function Board() {
  const params = useSearchParams();
  const filter = params.get("stage");
  const { data, reload } = useApi<StatsPayload>("/api/stats", 7000);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [query, setQuery] = useState("");

  const prospects = useMemo(() => {
    const all = data?.prospects ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) =>
      p.businessName.toLowerCase().includes(q) ||
      (p.city ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q) ||
      String(p.id) === q,
    );
  }, [data, query]);

  const purgeRejected = async () => {
    const rejected = (data?.prospects ?? []).filter((p) => p.stage === "rejected");
    if (rejected.length === 0) return setToast({ msg: "Aucun lead rejeté à purger.", kind: "ok" });
    setBusy("purge");
    try {
      await Promise.all(rejected.map((p) => fetch(`/api/prospects/${p.id}`, { method: "DELETE" })));
      setToast({ msg: `${rejected.length} lead(s) rejeté(s) supprimé(s).`, kind: "ok" });
      await reload();
    } finally { setBusy(null); }
  };

  const runAction = async (id: number, action: string, label: string) => {
    setBusy(`${id}-${action}`);
    try {
      const r = await fetch(`/api/prospects/${id}/advance`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const j = await apiJson<{ ok?: boolean; partial?: boolean; reason?: string; error?: string }>(r);
      if (!j) { setToast({ msg: "Serveur momentanément indisponible — réessaie.", kind: "err" }); return; }
      if (j.ok) setToast({ msg: j.partial ? `${label} — en cours, le lead continue automatiquement.` : `${label} — succès pour le lead #${id}.`, kind: "ok" });
      else setToast({ msg: j.reason ?? j.error ?? `Étape "${label}" terminée avec avertissement.`, kind: "err" });
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: number) => {
    await fetch(`/api/prospects/${id}`, { method: "DELETE" });
    setToast({ msg: `Lead #${id} supprimé.`, kind: "ok" });
    await reload();
  };

  const cols = BOARD_COLS.filter((c) => (filter ? c === filter : true));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[24px] text-white">Pipeline<span style={{ color: "var(--accent)" }}>.</span></h1>
          <p className="text-[13px]" style={{ color: "var(--text-dim)" }}>
            {prospects.length} lead(s) affiché(s) · chaque étape est exécutée par son agent. ⚡ = pipeline complet automatique.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
            <input className="input !py-2 !pl-9 !text-[12.5px]" style={{ width: 210 }} placeholder="Nom, ville, email, #id…"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <a className="btn-ghost !py-2" href={`/api/prospects/export${filter ? `?stage=${filter}` : ""}`} download>
            <Download size={13} /> CSV
          </a>
          <button className="btn-ghost btn-danger !py-2" onClick={purgeRejected} disabled={busy === "purge"}>
            {busy === "purge" ? <Loader2 size={13} className="animate-spin" /> : <Eraser size={13} />} Purger rejetés
          </button>
          <Link href="/rio" className="btn-ghost !py-2"><MessagesSquare size={13} /> Demander à RIO</Link>
          {filter && <Link href="/pipeline" className="btn-ghost !py-2">Tout voir</Link>}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 kanban-scroll items-start">
        {cols.map((col) => {
          const items = prospects.filter((p) => p.stage === col);
          const color = STAGE_COLORS[col];
          return (
            <div key={col} className="kanban-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="dot" style={{ background: color, boxShadow: `0 0 8px ${color}88` }} />
                <span className="text-[12px] font-bold tracking-wide uppercase" style={{ color }}>{STAGE_LABELS[col]}</span>
                <span className="font-mono text-[11px] ml-auto" style={{ color: "var(--text-faint)" }}>{items.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.length === 0 && (
                  <div className="card p-4 text-center text-[11.5px]" style={{ color: "var(--text-faint)" }}>Aucun lead</div>
                )}
                {items.map((p) => {
                  const next = NEXT_ACTION[p.stage];
                  const fullBusy = busy === `${p.id}-full`, nextBusy = busy === `${p.id}-${next?.action}`;
                  const rating = parseFloat(String(p.rating ?? "0"));
                  return (
                    <div key={p.id} className="card p-4 group">
                      <Link href={`/prospects/${p.id}`} className="no-underline block">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-[13.5px] font-semibold text-white leading-snug group-hover:underline">{p.businessName}</span>
                          <ChevronRight size={13} className="flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100" style={{ color: "var(--text-faint)" }} />
                        </div>
                        <div className="text-[11px] mb-2" style={{ color: "var(--text-faint)" }}>
                          {p.businessType} · {p.city ?? "?"} · <span className="font-mono">#{p.id}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          {rating > 0 && <Stars rating={rating} />}
                          <span className="font-mono text-[10px]" style={{ color: "var(--text-faint)" }}>{p.reviewCount ?? 0} avis</span>
                          {!p.hasWebsite && <span className="chip" style={{ color: "var(--accent)", borderColor: "rgba(0,229,160,.25)", fontSize: 9.5 }}>sans site</span>}
                          {p.emailStatus === "valid" && <span className="chip" style={{ color: "var(--violet)", borderColor: "rgba(167,139,250,.3)", fontSize: 9.5 }}>email ✓</span>}
                          {typeof p.aiScore === "number" && (
                            <span className="chip" style={{ color: "var(--violet)", borderColor: "rgba(167,139,250,.3)", fontSize: 9.5 }}
                              title={p.aiInsight ?? ""}>
                              IA {p.aiScore}/100
                            </span>
                          )}
                          {p.hasSite && <span className="chip" style={{ color: "var(--pink)", borderColor: "rgba(244,114,182,.3)", fontSize: 9.5 }}>site ✓</span>}
                          {p.deployedUrl && <span className="chip" style={{ color: "#60a5fa", borderColor: "rgba(96,165,250,.3)", fontSize: 9.5 }}>live</span>}
                        </div>
                        {p.stage === "rejected" && p.rejectReason && (
                          <div className="text-[10.5px] mb-3 flex items-start gap-1.5" style={{ color: "var(--red)" }}>
                            <Ban size={11} className="flex-shrink-0 mt-0.5" /> {p.rejectReason}
                          </div>
                        )}
                      </Link>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {next && (
                          <button className="btn-ghost !py-1.5 !px-2.5 !text-[10.5px]" disabled={nextBusy || fullBusy}
                            onClick={() => runAction(p.id, next.action, next.label)}>
                            {nextBusy ? <Loader2 size={11} className="animate-spin" /> : <StepForward size={11} />}
                            {next.label}
                          </button>
                        )}
                        {p.stage !== "rejected" && (
                          <button className="btn-ghost !py-1.5 !px-2.5 !text-[10.5px]" disabled={fullBusy || nextBusy}
                            style={{ color: "var(--accent)", borderColor: "rgba(0,229,160,.25)" }}
                            onClick={() => runAction(p.id, "full", "Pipeline complet")}>
                            {fullBusy ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                            Auto
                          </button>
                        )}
                        {p.deployedUrl && (
                          <a href={p.deployedUrl} target="_blank" rel="noopener" className="btn-ghost !py-1.5 !px-2.5 !text-[10.5px]">
                            <ExternalLink size={11} />
                          </a>
                        )}
                        <button className="btn-ghost btn-danger !py-1.5 !px-2.5 !text-[10.5px] ml-auto" onClick={() => remove(p.id)} title="Supprimer ce lead">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {toast && <Toast msg={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="text-[13px]" style={{ color: "var(--text-faint)" }}>Chargement du pipeline…</div>}>
      <Board />
    </Suspense>
  );
}
