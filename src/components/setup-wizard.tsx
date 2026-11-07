"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiJson } from "@/components/ui";
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2, Wand2, Copy, Check,
} from "lucide-react";

type Check = {
  key: string; label: string; status: "ok" | "warn" | "down";
  detail: string; fixHref: string; required: boolean;
};
type Diag = { checks: Check[]; detectedBase: string; productionReady: boolean; blocking: string[]; score: number };

const ICON = {
  ok: { Comp: CheckCircle2, color: "var(--accent)" },
  warn: { Comp: AlertTriangle, color: "var(--amber)" },
  down: { Comp: XCircle, color: "var(--red)" },
};

export function SetupWizard({ onChanged }: { onChanged?: () => void }) {
  const [diag, setDiag] = useState<Diag | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/diagnostics", { cache: "no-store" });
      const j = await apiJson<Diag>(r);
      if (j) setDiag(j);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Record<string, string>) => {
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    await load();
    onChanged?.();
  };

  const autoConfigure = async () => {
    setFixing("auto");
    try {
      const base = diag?.detectedBase || window.location.origin;
      const secret = `gsd_${crypto.randomUUID().replace(/-/g, "")}`;
      await save({ APP_BASE_URL: base, AUTOPILOT: "true", ALLOW_SIMULATION: "false", CRON_SECRET: secret });
      // Enregistre le webhook Telegram si le token est présent
      await fetch("/api/telegram/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appBaseUrl: base }) }).catch(() => {});
      await load();
    } finally { setFixing(null); }
  };

  const fixOne = async (key: string) => {
    setFixing(key);
    try {
      const base = diag?.detectedBase || window.location.origin;
      if (key === "appurl") await save({ APP_BASE_URL: base });
      if (key === "autopilot") await save({ AUTOPILOT: "true" });
      if (key === "mode") await save({ ALLOW_SIMULATION: "false" });
      if (key === "cron") await save({ CRON_SECRET: `gsd_${crypto.randomUUID().replace(/-/g, "")}` });
      if (key === "telegram") {
        await fetch("/api/telegram/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appBaseUrl: base }) });
        await load();
      }
    } finally { setFixing(null); }
  };

  const AUTO_FIXABLE = new Set(["appurl", "autopilot", "mode", "cron", "telegram"]);
  const cronUrl = `${diag?.detectedBase ?? ""}/api/cron/tick`;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,229,160,.1)", border: "1px solid rgba(0,229,160,.3)" }}>
            <Wand2 size={17} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h2 className="font-display font-bold text-[16px] text-white">Assistant de configuration</h2>
            <p className="text-[12px] mt-0.5 leading-relaxed max-w-xl" style={{ color: "var(--text-dim)" }}>
              Diagnostic en direct de chaque brique. Les réglages système (URL publique, auto-pilote, mode production,
              secret cron, webhook Telegram) se configurent en un clic — pas besoin de les écrire à la main.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !py-2" onClick={load}><RefreshCw size={13} /> Re-tester</button>
          <button className="btn-primary !py-2" onClick={autoConfigure} disabled={fixing !== null}>
            {fixing === "auto" ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Tout configurer
          </button>
        </div>
      </div>

      {/* Score */}
      {diag && (
        <div className="flex items-center gap-4 mb-5 p-4 rounded-xl" style={{ background: "rgba(0,0,0,.28)", border: "1px solid var(--border)" }}>
          <div className="font-display font-bold text-[32px] leading-none"
            style={{ color: diag.score >= 80 ? "var(--accent)" : diag.score >= 50 ? "var(--amber)" : "var(--red)" }}>
            {diag.score}%
          </div>
          <div className="flex-1">
            <div className="progress mb-2">
              <div className="progress-fill" style={{ width: `${diag.score}%`, background: diag.score >= 80 ? "var(--accent)" : "var(--amber)" }} />
            </div>
            <div className="text-[12px]" style={{ color: diag.productionReady ? "var(--accent)" : "var(--amber)" }}>
              {diag.productionReady
                ? "Aucun blocage critique — la chaîne complète peut tourner en production."
                : `Blocages critiques : ${diag.blocking.join(" · ")}`}
            </div>
          </div>
        </div>
      )}

      {/* Checks */}
      {loading ? (
        <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>Diagnostic en cours…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {diag?.checks.map((c) => {
            const { Comp, color } = ICON[c.status];
            const canFix = AUTO_FIXABLE.has(c.key) && c.status !== "ok";
            return (
              <div key={c.key} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(0,0,0,.22)", border: `1px solid ${c.status === "down" && c.required ? "rgba(248,113,113,.25)" : "var(--border)"}` }}>
                <Comp size={15} className="mt-0.5 flex-shrink-0" style={{ color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-white">{c.label}</span>
                    {c.required && c.status === "down" && (
                      <span className="chip" style={{ color: "var(--red)", borderColor: "rgba(248,113,113,.35)", fontSize: 9.5 }}>BLOQUANT</span>
                    )}
                  </div>
                  <div className="text-[11.5px] mt-0.5 leading-relaxed break-all" style={{ color: "var(--text-dim)" }}>{c.detail}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canFix && (
                    <button className="btn-ghost !py-1.5 !px-3 !text-[11px]" onClick={() => fixOne(c.key)} disabled={fixing !== null}
                      style={{ color: "var(--accent)", borderColor: "rgba(0,229,160,.25)" }}>
                      {fixing === c.key ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />} Corriger
                    </button>
                  )}
                  {c.status !== "ok" && !canFix && (
                    <Link href={c.fixHref} className="btn-ghost !py-1.5 !px-3 !text-[11px]">Configurer</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cron explanation */}
      <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="label-xs mb-2">Comment tourne le 24/7 ?</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {[
            { t: "1 · Cron Vercel", d: "vercel.json déclenche /api/cron/tick toutes les heures, automatiquement après déploiement. Rien à faire." },
            { t: "2 · Booster console", d: "Tant qu'un onglet du tableau de bord est ouvert, un cycle part toutes les 5 minutes." },
            { t: "3 · À la demande", d: "Bouton « Cycle maintenant », commande /tick sur Telegram, ou demande à RIO en langage naturel." },
          ].map((x) => (
            <div key={x.t} className="p-3.5 rounded-xl" style={{ background: "rgba(0,0,0,.25)", border: "1px solid var(--border)" }}>
              <div className="text-[12px] font-semibold text-white mb-1">{x.t}</div>
              <div className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{x.d}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <code className="input font-mono !text-[11.5px] flex-1 truncate" style={{ paddingTop: 10 }}>{cronUrl}</code>
          <button className="btn-ghost" onClick={async () => { await navigator.clipboard.writeText(cronUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check size={13} style={{ color: "var(--accent)" }} /> : <Copy size={13} />} Copier
          </button>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
          Pour un cron externe (cron-job.org, UptimeRobot…), appelez cette URL avec l'en-tête <code>Authorization: Bearer VOTRE_CRON_SECRET</code> ou en ajoutant <code>?secret=…</code>.
        </p>
      </div>
    </div>
  );
}
