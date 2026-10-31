"use client";

import { useEffect, useRef, useState } from "react";
import {
  Radar, BadgeCheck, MailCheck, ClipboardList, Code2, Rocket, Send, CreditCard, Globe, LifeBuoy,
  Crown, Bot, type LucideIcon,
} from "lucide-react";

export const AGENT_ICONS: Record<string, LucideIcon> = {
  prospector: Radar, validator: BadgeCheck, emailor: MailCheck, mapper: ClipboardList,
  coder: Code2, deployer: Rocket, saler: Send, paymer: CreditCard, domainner: Globe,
  support: LifeBuoy, telegram: Send, rio: Crown, autopilot: Bot,
};

export const STAGE_LABELS: Record<string, string> = {
  discovered: "Découvert", validated: "Qualifié", email_verified: "Email vérifié",
  mapped: "Fiche complète", site_built: "Site généré", deployed: "Déployé",
  contacted: "Contacté", paid: "Payé", domain_linked: "Domaine lié", rejected: "Rejeté",
};

export const STAGE_COLORS: Record<string, string> = {
  discovered: "#38bdf8", validated: "#34d399", email_verified: "#a78bfa", mapped: "#fbbf24",
  site_built: "#f472b6", deployed: "#60a5fa", contacted: "#fb923c", paid: "#00e5a0",
  domain_linked: "#22d3ee", rejected: "#f87171",
};

export function stageChipStyle(stage: string) {
  const c = STAGE_COLORS[stage] ?? "#9aa4b2";
  return { color: c, borderColor: `${c}44`, background: `${c}14` } as const;
}

// Poll an API endpoint
export function useApi<T>(url: string, intervalMs = 0): { data: T | null; reload: () => Promise<void>; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const load = async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as T;
      if (alive.current !== false) setData(j);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    load();
    if (intervalMs > 0) {
      const t = setInterval(load, intervalMs);
      return () => { alive.current = false; clearInterval(t); };
    }
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, intervalMs]);
  return { data, reload: load, loading };
}

// Animated count-up
export function CountUp({ value, suffix = "", duration = 1400 }: { value: number; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = to;
    if (from === to) { setDisplay(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tabular-nums">{display.toLocaleString("fr-FR")}{suffix}</span>;
}

export function Toast({ msg, kind, onClose }: { msg: string; kind: "ok" | "err"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="toast fixed bottom-6 right-6 z-50 card px-5 py-3.5 flex items-center gap-3 max-w-md"
      style={{ borderColor: kind === "ok" ? "rgba(0,229,160,.4)" : "rgba(248,113,113,.4)", background: "rgba(10,14,20,.92)" }}>
      <span className="dot" style={{ background: kind === "ok" ? "var(--accent)" : "var(--red)", boxShadow: "none", animation: "none" }} />
      <span className="text-[13px]" style={{ color: "var(--text)" }}>{msg}</span>
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${rating.toFixed(1)}/5`}>
      <span style={{ color: "#fbbf24", letterSpacing: 1, fontSize: 11 }}>
        {"★".repeat(Math.round(rating))}{"☆".repeat(Math.max(0, 5 - Math.round(rating)))}
      </span>
      <span className="font-mono text-[11px]" style={{ color: "var(--text-dim)" }}>{rating.toFixed(1)}</span>
    </span>
  );
}
