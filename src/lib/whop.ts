// Paymer — lien de paiement via Whop. Sans clé : paiement simulé.

import { getSetting } from "./settings";
import type { Prospect } from "@/db/schema";

export type PaymentResult = { ok: boolean; url: string; simulated: boolean; error?: string };

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
  try {
    const res = await fetch("https://api.whop.com/api/v2/checkout_links", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        metadata: { prospect_id: String(p.id), business: p.businessName },
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json()) as { checkout_link?: string; purchase_url?: string; error?: string };
    const url = json.checkout_link ?? json.purchase_url;
    if (!res.ok || !url) return { ok: false, url: "", simulated: false, error: json.error ?? `HTTP ${res.status}` };
    return { ok: true, url, simulated: false };
  } catch (err) {
    return { ok: false, url: "", simulated: false, error: err instanceof Error ? err.message : "network" };
  }
}
