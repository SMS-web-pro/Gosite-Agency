// Deployer — déploie le site sur Vercel : sous-domaine {clientId}.{domaine-agence}.
// Sans token configuré : déploiement simulé + preview sandbox active.

import { getSetting, allowSimulation } from "./settings";

// Normalise le domaine agence : tolère les réglages stockés comme URL complète
// ("https://gosite.digital/") et les ramène au domaine nu "gosite.digital".
function normalizeAgencyDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export function slugifyId(name: string): string {
  const s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return s || "site";
}

export type DeployResult = {
  ok: boolean;
  url: string;
  mode: "vercel" | "simulated";
  error?: string;
};

export async function deployToVercel(slug: string, html: string): Promise<DeployResult> {
  const token = await getSetting("VERCEL_TOKEN");
  const teamId = await getSetting("VERCEL_TEAM_ID");
  const agencyDomain = normalizeAgencyDomain((await getSetting("AGENCY_DOMAIN")) || "gosite.digital");

  if (!token) {
    if (!(await allowSimulation())) {
      return { ok: false, url: "", mode: "vercel", error: "VERCEL_TOKEN non configuré (Réglages → Vercel). Sans token, aucun déploiement réel n'est possible." };
    }
    return { ok: true, url: `https://${slug}.${agencyDomain}`, mode: "simulated" };
  }

  try {
    // forceNew : évite la déduplication silencieuse d'un déploiement identique ;
    // outputDirectory "." : indispensable pour un site statique sans build
    // (sinon Vercel crée un déploiement SANS fichiers qui sert sa page par défaut).
    const qs = `${teamId ? `teamId=${encodeURIComponent(teamId)}&` : ""}forceNew=1`;
    const res = await fetch(`https://api.vercel.com/v13/deployments?${qs}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: slug,
        target: "production",
        files: [{ file: "index.html", data: Buffer.from(html, "utf8").toString("base64"), encoding: "base64" }],
        projectSettings: { framework: null, buildCommand: "", installCommand: "", outputDirectory: "." },
      }),
      signal: AbortSignal.timeout(60000),
    });
    const json = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) {
      return { ok: false, url: "", mode: "vercel", error: json.error?.message ?? `HTTP ${res.status}` };
    }
    // L'équipe active "Deployment Protection" (all_except_custom_domains) : les
    // URLs *.vercel.app servent alors la page login SSO au lieu du site. On
    // lève cette protection pour chaque projet client, best-effort.
    await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(slug)}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`,
      { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ssoProtection: null }), signal: AbortSignal.timeout(15000) },
    ).catch(() => {});
    return { ok: true, url: `https://${json.url}`, mode: "vercel" };
  } catch (err) {
    return { ok: false, url: "", mode: "vercel", error: err instanceof Error ? err.message : "network" };
  }
}

// v6 : déploiement d'un BUNDLE multi-fichiers (index + pages auxiliaires +
// images locales). target production → le déploiement est aliasé par Vercel
// sur l'URL stable du projet : https://{slug}.vercel.app. Les fichiers binaires
// du bundle (images) sont déjà en base64 : passés tels quels ; les textes sont
// encodés ici. Compat : deployToVercel reste pour les leads legacy (single-file).
const BINARY_FILE_RE = /\.(jpe?g|png|gif|webp|avif|ico)$/i;

export async function deploySiteBundle(slug: string, bundle: Record<string, string>): Promise<DeployResult> {
  const token = await getSetting("VERCEL_TOKEN");
  const teamId = await getSetting("VERCEL_TEAM_ID");
  const agencyDomain = normalizeAgencyDomain((await getSetting("AGENCY_DOMAIN")) || "gosite.digital");

  if (!token) {
    if (!(await allowSimulation())) {
      return { ok: false, url: "", mode: "vercel", error: "VERCEL_TOKEN non configuré (Réglages → Vercel)." };
    }
    return { ok: true, url: `https://${slug}.${agencyDomain}`, mode: "simulated" };
  }

  try {
    const files = Object.entries(bundle).map(([file, content]) => ({
      file,
      data: BINARY_FILE_RE.test(file) ? content : Buffer.from(content, "utf8").toString("base64"),
      encoding: "base64",
    }));
    const qs = `${teamId ? `teamId=${encodeURIComponent(teamId)}&` : ""}forceNew=1`;
    const res = await fetch(`https://api.vercel.com/v13/deployments?${qs}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: slug,
        target: "production",
        files,
        projectSettings: { framework: null, buildCommand: "", installCommand: "", outputDirectory: "." },
      }),
      signal: AbortSignal.timeout(90000),
    });
    const json = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) {
      return { ok: false, url: "", mode: "vercel", error: json.error?.message ?? `HTTP ${res.status}` };
    }
    await fetch(
      `https://api.vercel.com/v9/projects/${encodeURIComponent(slug)}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`,
      { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ssoProtection: null }), signal: AbortSignal.timeout(15000) },
    ).catch(() => {});
    // Alias STABLE du projet (pas l'URL de déploiement à hash variable).
    return { ok: true, url: `https://${slug}.vercel.app`, mode: "vercel" };
  } catch (err) {
    return { ok: false, url: "", mode: "vercel", error: err instanceof Error ? err.message : "network" };
  }
}

const CF_API = "https://api.cloudflare.com/client/v4";function registrableOf(domain: string): string {
  const p = domain.split(".");
  return p.length >= 2 ? p.slice(-2).join(".") : domain;
}

// Pousse automatiquement dans Cloudflare les TXT de vérification exigés par
// Vercel, puis force la re-vérification. Sans jeton Cloudflare ou hors domaine
// agence : étape ignorée silencieusement (déploiement reste opérationnel).
async function autoVerifyDomain(domain: string, projectSlug: string, vercelToken: string, teamId: string | null): Promise<void> {
  try {
    const cfToken = (await getSetting("CLOUDFLARE_TOKEN")) || process.env.CLOUDFLARE_TOKEN;
    if (!cfToken) return;
    const zone = registrableOf(domain);
    const zh = { Authorization: `Bearer ${cfToken}` };
    const zres = await fetch(`${CF_API}/zones?name=${encodeURIComponent(zone)}`, { headers: zh, signal: AbortSignal.timeout(15000) });
    const zoneId = ((await zres.json()) as { result?: { id: string }[] }).result?.[0]?.id;
    if (!zoneId) return;

    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const vh = { Authorization: `Bearer ${vercelToken}` };
    const dres = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectSlug)}/domains/${encodeURIComponent(domain)}${qs}`, { headers: vh, signal: AbortSignal.timeout(15000) });
    const dj = (await dres.json()) as { verified?: boolean; verification?: { type?: string; domain: string; value: string; reason?: string }[] };
    const pending = (dj.verification || []).filter((v) => v.value && /domain-verify/.test(v.value));
    if (!pending.length) return;

    const er = await fetch(`${CF_API}/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(pending[0].domain)}`, { headers: zh, signal: AbortSignal.timeout(15000) });
    const existing = new Set(((await er.json()) as { result?: { content: string }[] }).result?.map((r) => r.content) || []);

    for (const v of pending) {
      if (existing.has(v.value)) continue;
      await fetch(`${CF_API}/zones/${zoneId}/dns_records`, {
        method: "POST",
        headers: { ...zh, "Content-Type": "application/json" },
        body: JSON.stringify({ type: v.type || "TXT", name: v.domain, content: v.value, ttl: 60, proxied: false }),
        signal: AbortSignal.timeout(15000),
      });
    }
    // Toutes les valeurs poussées : Vercel re-vérifie (poll court + appel best-effort).
    await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectSlug)}/domains/${encodeURIComponent(domain)}/verify${qs}`, { method: "POST", headers: vh, signal: AbortSignal.timeout(15000) }).catch(() => {});
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const c = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectSlug)}/domains/${encodeURIComponent(domain)}${qs}`, { headers: vh, signal: AbortSignal.timeout(15000) });
      const cj = (await c.json()) as { verified?: boolean };
      if (cj.verified) {
        console.log(`[deployer] ${domain} vérifié et SSL en cours (${(i + 1) * 5}s)`);
        return;
      }
      await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectSlug)}/domains/${encodeURIComponent(domain)}/verify${qs}`, { method: "POST", headers: vh, signal: AbortSignal.timeout(15000) }).catch(() => {});
    }
    console.warn(`[deployer] ${domain} lié mais vérification DNS non confirmée dans les 20s (elle aboutira toute seule)`);
  } catch (err) {
    console.warn("[deployer] auto-vérification DNS impossible (non bloquant):", err instanceof Error ? err.message : err);
  }
}

// Domainner — lie un domaine personnalisé au projet Vercel
export async function linkDomain(slug: string, domain: string): Promise<{ ok: boolean; url: string; mode: "vercel" | "simulated"; error?: string }> {
  const token = await getSetting("VERCEL_TOKEN");
  const teamId = await getSetting("VERCEL_TEAM_ID");
  const agencyDomain = normalizeAgencyDomain((await getSetting("AGENCY_DOMAIN")) || "gosite.digital");
  const finalDomain = domain || `${slug}.${agencyDomain}`;

  if (!token) {
    if (!(await allowSimulation())) {
      return { ok: false, url: "", mode: "vercel", error: "VERCEL_TOKEN requis pour lier un domaine (Réglages → Vercel)." };
    }
    return { ok: true, url: `https://${finalDomain}`, mode: "simulated" };
  }
  try {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const res = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(slug)}/domains${qs}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: finalDomain }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const msg = (json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
      // Le domaine peut déjà être lié à CE projet (re-déploiement) : l'API
      // Vercel refuse le doublon. On vérifie la liste des domaines du projet ;
      // s'il est bien présent, c'est un succès (idempotent).
      if (/already assigned|already exists/i.test(msg)) {
        const lst = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(slug)}/domains${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(30000),
        });
        if (lst.ok) {
          const lj = (await lst.json().catch(() => ({ domains: [] }))) as { domains?: { name?: string }[] };
          const present = (lj.domains ?? []).some((d) => d.name?.toLowerCase() === finalDomain.toLowerCase());
          if (present) return { ok: true, url: `https://${finalDomain}`, mode: "vercel" };
        }
      }
      return { ok: false, url: "", mode: "vercel", error: msg };
    }
    await autoVerifyDomain(finalDomain, slug, token, teamId);
    return { ok: true, url: `https://${finalDomain}`, mode: "vercel" };
  } catch (err) {
    return { ok: false, url: "", mode: "vercel", error: err instanceof Error ? err.message : "network" };
  }
}
