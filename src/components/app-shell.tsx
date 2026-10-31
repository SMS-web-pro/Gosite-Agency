"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Bot, KanbanSquare, Settings2, Send, Hexagon, Crown, Radio, MessagesSquare,
} from "lucide-react";

type Integrations = Record<string, boolean>;

const NAV = [
  { href: "/", label: "Mission Control", icon: LayoutDashboard },
  { href: "/rio", label: "Chat avec RIO", icon: MessagesSquare },
  { href: "/agents", label: "Agents IA", icon: Bot },
  { href: "/pipeline", label: "Pipeline Leads", icon: KanbanSquare },
  { href: "/telegram", label: "Telegram Ops", icon: Send },
  { href: "/settings", label: "Réglages & API", icon: Settings2 },
];

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[12px] tabular-nums" style={{ color: "var(--text-dim)" }}>
      {now ? now.toLocaleTimeString("fr-FR", { hour12: false }) : "--:--:--"}
      <span className="caret" style={{ color: "var(--accent)" }}>_</span>
    </span>
  );
}

function IntegrationBadges({ integrations }: { integrations: Integrations }) {
  const items = [
    { k: "telegram", label: "TG" },
    { k: "llm", label: "LLM" },
    { k: "brevo", label: "Brevo" },
    { k: "vercel", label: "Vercel" },
    { k: "whop", label: "Whop" },
  ];
  return (
    <div className="hidden lg:flex items-center gap-1.5">
      {items.map((i) => (
        <span
          key={i.k}
          className="chip"
          style={
            integrations[i.k]
              ? { color: "var(--accent)", borderColor: "rgba(0,229,160,.3)", background: "var(--accent-dim)" }
              : { color: "var(--text-faint)" }
          }
          title={integrations[i.k] ? `${i.label} connecté (LIVE)` : `${i.label} non configuré (SIM)`}
        >
          <span className="dot" style={{ width: 5, height: 5, background: integrations[i.k] ? "var(--accent)" : "var(--text-faint)", boxShadow: "none", animation: "none" }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function AppShell({ children, integrations }: { children: ReactNode; integrations: Integrations }) {
  const pathname = usePathname();
  return (
    <div className="relative z-10 flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="sidebar fixed inset-y-0 left-0 w-[232px] flex flex-col border-r z-30"
        style={{ borderColor: "var(--border)", background: "linear-gradient(180deg, rgba(10,14,20,.92), rgba(6,8,12,.96))", backdropFilter: "blur(14px)" }}>
        <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-5 no-underline">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "var(--accent-dim)", border: "1px solid rgba(0,229,160,.3)" }}>
            <Hexagon size={20} style={{ color: "var(--accent)" }} strokeWidth={2.2} />
            <Radio size={9} className="absolute" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div className="font-display font-bold text-[16px] leading-tight text-white">GoSite <span style={{ color: "var(--accent)" }}>Digital</span></div>
            <div className="text-[10px] tracking-[0.16em] uppercase" style={{ color: "var(--text-faint)" }}>AI Agency OS</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1 px-3 mt-1">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={`navlink ${active ? "active" : ""}`}>
                <n.icon size={16} strokeWidth={2} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 mt-7 mb-2 label-xs">Équipe d'agents</div>
        <AgentsMini />

        <div className="mt-auto px-3 pb-5">
          <Link href="/rio" className="card p-4 flex items-center gap-3 no-underline card-hover">
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-[13px] flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#00e5a0,#38bdf8)", color: "#05281c" }}>
              R
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
                RIO <Crown size={12} style={{ color: "var(--amber)" }} />
              </div>
              <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>CEO · Parler au patron</div>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 md:ml-[232px]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-6 py-3.5 border-b"
          style={{ borderColor: "var(--border)", background: "rgba(6,8,12,.78)", backdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-3">
            <span className="dot dot-ready" />
            <span className="text-[12px] font-semibold tracking-wide" style={{ color: "var(--text-dim)" }}>
              TOUS SYSTÈMES OPÉRATIONNELS
            </span>
          </div>
          <div className="flex items-center gap-5">
            <IntegrationBadges integrations={integrations} />
            <LiveClock />
          </div>
        </header>
        <main className="px-6 py-6 max-w-[1400px] mx-auto">{children}</main>
      </div>
    </div>
  );
}

// Self-updating agent status strip in sidebar
function AgentsMini() {
  const [agents, setAgents] = useState<{ key: string; name: string; status: string }[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/agents");
        const j = await r.json();
        if (alive) setAgents(j.agents ?? []);
      } catch { /* noop */ }
    };
    load();
    const t = setInterval(load, 6000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return (
    <div className="px-3 flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: "42vh" }}>
      {agents.map((a) => (
        <Link key={a.key} href="/agents" className="flex items-center gap-2.5 px-3 py-[5px] rounded-lg no-underline hover:bg-white/5 transition-colors">
          <span className={`dot dot-${a.status}`} style={{ width: 7, height: 7 }} />
          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-dim)" }}>{a.name}</span>
          <span className="ml-auto font-mono text-[9.5px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{a.status}</span>
        </Link>
      ))}
    </div>
  );
}
