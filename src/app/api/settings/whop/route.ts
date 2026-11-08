import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { tryEndpoint } from "@/lib/whop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = await getSetting("WHOP_API_KEY");
    const planId = await getSetting("WHOP_PLAN_ID");
    if (!apiKey || !planId) {
      return NextResponse.json({ probe: [{ label: "Configuration", ok: false, info: "WHOP_API_KEY ou WHOP_PLAN_ID manquant dans les Réglages." }] });
    }
    const link = await tryEndpoint(apiKey, planId, { id: 0, businessName: "Test sonde" } as never, "checkout_links");
    if (link.url) {
      return NextResponse.json({ probe: [{ label: "Lien de paiement", ok: true, info: `OK — url générée : ${link.url}` }] });
    }
    const session = await tryEndpoint(apiKey, planId, { id: 0, businessName: "Test sonde" } as never, "checkout_sessions");
    if (session.url) {
      return NextResponse.json({ probe: [{ label: "Session de paiement", ok: true, info: `OK — url générée : ${session.url}` }] });
    }
    return NextResponse.json({ probe: [{ label: "Whop", ok: false, info: session.error ?? link.error ?? "erreur inconnue" }] });
  } catch (err) {
    return NextResponse.json({ probe: [{ label: "Whop", ok: false, info: err instanceof Error ? err.message : "erreur" }] });
  }
}
