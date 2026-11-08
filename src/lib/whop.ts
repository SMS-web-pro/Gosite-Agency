// Paymer — lien de paiement via Whop. Sans clé : paiement simulé.
// API v2 : la création de session de paiement exige des permissions activées
// sur la page Développeur de Whop — sans elles l'API renvoie un 401 explicite.

import { getSetting } from "./settings";
import type { Prospect } from "@/db/schema";

export type PaymentResult = { ok: boolean; url: string; simulated: boolean; error?: string };

type WhopJson = { checkout_link?: string; purchase_url?: string; error?: { message?: string; status?: number } | string };

function whopError(json: WhopJson | null, status: number): string {
  const raw = json?.error;
  const msg = typeof raw === "string" ? raw : raw?.message || "";
  if (/permission|does not have/i.test(msg)) {
    return "Whop : la clé API est valide mais ses permissions de paiement ne sont pas activées — sur whop.com/_dashboard, ouvre Développeur → API Keys → donne à la clé les permissions « Créer une session de paiement » et « Créer un lien de paiement ». (Détail Whop : " + (msg || `HTTP ${status}`) + ")";
  }
  return msg ? `Whop (${status}) : ${msg}` : `Whop : HTTP ${status}`;
}

async function tryEndpointShared(
  apiKey: string,
  planId: string,
  p: Pick<Prospect, "id" | "businessName">,
  endpoint: "checkout_links" | "checkout_sessions",
): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.whop.com/api/v2/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        metadata: { prospect_id: String(p.id), business: p.businessName },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => null)) as WhopJson | null;
    const url = json?.checkout_link ?? json?.purchase_url;
    if (res.ok && url) return { url };
    return { error: whopError(json, res.status) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "réseau" };
  }
}

/** Sonde Réglages : crée une vraie session de test (sans débit) pour vérifier
 * que la clé + les permissions permettent bien de générer un lien de paiement. */
export async function tryEndpoint(
  apiKey: string,
  planId: string,
  p: Pick<Prospect, "id" | "businessName">,
  endpoint: "checkout_links" | "checkout_sessions",
): Promise<{ url?: string; error?: string }> {
  return tryEndpointShared(apiKey, planId, p, endpoint);
}

export async function createWhopPayment(p: Prospect): Promise<PaymentResult> {
  const apiKey = await getSetting("WHOP_API_KEY");
  const planId = await getSetting("WHOP_PLAN_ID");
  const price = (await getSetting("OFFER_PRICE")) || "490";
  const currency = (await getSetting("OFFER_CURRENCY")) || "EUR";

  if (!apiKey || !planId) {
    const { allowSimulation } = await import("./settings");
    if (!(await allowSimulation())) {
      return { ok: false, url: "", simulated: false, error: "Whop non configuré (WHOP_API_KEY + WHOP_PLAN_ID dans Réglages)." };
    }
    return {
      ok: true,
      url: `https://whop.com/checkout/sim-${p.id}?plan=site-vitrine&amount=${price}&cur=${currency}`,
      simulated: true,
    };
  }
  // 1) Lien de paiement réutilisable (checkout_links), 2) session à usage unique.
  const link = await tryEndpoint(apiKey, planId, p, "checkout_links");
  if (link.url) return { ok: true, url: link.url, simulated: false };
  const session = await tryEndpoint(apiKey, planId, p, "checkout_sessions");
  if (session.url) return { ok: true, url: session.url, simulated: false };
  return { ok: false, url: "", simulated: false, error: session.error ?? link.error };
}
