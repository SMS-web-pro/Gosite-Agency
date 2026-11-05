import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { serperKeys } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import { ensureSchema } from "@/db/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSchema();
  const rows = await db.select().from(serperKeys).orderBy(asc(serperKeys.createdAt));
  // Ne jamais renvoyer les clés en clair — l'UI n'affiche que label/crédits/statut.
  return NextResponse.json({
    keys: rows.map((k) => ({ ...k, apiKey: `${k.apiKey.slice(0, 6)}••••${k.apiKey.slice(-4)}` })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { apiKey?: string; label?: string };
  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey || apiKey.length < 10) return NextResponse.json({ error: "Clé Serper invalide" }, { status: 400 });
  const label = (body.label ?? "").trim() || `Compte ${new Date().toLocaleDateString("fr-FR")}`;
  try {
    const rows = await db.insert(serperKeys).values({ apiKey, label, creditLimit: 2500, creditsUsed: 0, status: "active", isProvisioned: false }).returning();
    await logActivity({ agentKey: "rio", action: "cle_serper_ajoutee", message: `Nouvelle clé Serper ajoutée : ${label} (${apiKey.slice(0, 6)}••••) — 2500 crédits. Prospector passe en mode LIVE.`, level: "success" });
    return NextResponse.json({ ok: true, key: rows[0] });
  } catch {
    return NextResponse.json({ error: "Cette clé existe déjà" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await db.delete(serperKeys).where(eq(serperKeys.id, id));
  await logActivity({ agentKey: "rio", action: "cle_serper_supprimee", message: `Clé Serper #${id} supprimée par RIO.`, level: "warn" });
  return NextResponse.json({ ok: true });
}
