// Deployer — déploie le site sur Vercel : sous-domaine {clientId}.{domaine-agence}.
// Sans token configuré : déploiement simulé + preview sandbox active.

import { getSetting, allowSimulation } from "./settings";

export function slugifyId(name: string, id: number): string {
  const s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return `c${id}-${s || "site"}`;
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
  const agencyDomain = (await getSetting("AGENCY_DOMAIN")) || "gosite.digital";

  if (!token) {
    if (!(await allowSimulation())) {
      return { ok: false, url: "", mode: "vercel", error: "VERCEL_TOKEN non configuré (Réglages → Vercel). Sans token, aucun déploiement réel n'est possible." };
    }
    return { ok: true, url: `https://${slug}.${agencyDomain}`, mode: "simulated" };
  }

  try {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const res = await fetch(`https://api.vercel.com/v13/deployments${qs}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: slug,
        target: "production",
        files: [{ file: "index.html", data: html }],
        projectSettings: { framework: null },
      }),
      signal: AbortSignal.timeout(60000),
    });
    const json = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) {
      return { ok: false, url: "", mode: "vercel", error: json.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, url: `https://${json.url}`, mode: "vercel" };
  } catch (err) {
    return { ok: false, url: "", mode: "vercel", error: err instanceof Error ? err.message : "network" };
  }
}

// Domainner — lie un domaine personnalisé au projet Vercel
export async function linkDomain(slug: string, domain: string): Promise<{ ok: boolean; url: string; mode: "vercel" | "simulated"; error?: string }> {
  const token = await getSetting("VERCEL_TOKEN");
  const teamId = await getSetting("VERCEL_TEAM_ID");
  const agencyDomain = (await getSetting("AGENCY_DOMAIN")) || "gosite.digital";
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
      return { ok: false, url: "", mode: "vercel", error: (json as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, url: `https://${finalDomain}`, mode: "vercel" };
  } catch (err) {
    return { ok: false, url: "", mode: "vercel", error: err instanceof Error ? err.message : "network" };
  }
}
