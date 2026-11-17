import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { loginAttempts, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  loginDecision,
  secureEqual,
  signSession,
  hashToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const adminKey = process.env.ADMIN_KEY || "";
  if (!adminKey) {
    return NextResponse.json({ error: "ADMIN_KEY non configurée sur le serveur" }, { status: 503 });
  }

  // Rate limit 5 tentatives / 15 min / IP — en base, donc partagé entre les
  // instances serverless (un compteur en mémoire serait par-processus).
  const ip = clientIp(req);
  try {
    const row = (await db.select().from(loginAttempts).where(eq(loginAttempts.ip, ip)).limit(1))[0];
    const decision = loginDecision(
      row?.count ?? 0,
      row?.windowStart ? new Date(row.windowStart).getTime() : null,
      Date.now(),
    );
    if (decision.allowed) {
      const values = { count: decision.count, windowStart: new Date(decision.windowStart) };
      if (row) await db.update(loginAttempts).set(values).where(eq(loginAttempts.ip, ip));
      else await db.insert(loginAttempts).values({ ip, ...values });
    }
    if (!decision.allowed) {
      return NextResponse.json({ error: "Trop de tentatives — réessayez dans 15 minutes." }, { status: 429 });
    }
  } catch {
    // Rate limit indisponible (base down) : on refuse par défaut (fail-closed).
    return NextResponse.json({ error: "Service indisponible — réessayez." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { password?: string };
  // Comparaison à temps constant (sha256 + XOR) : pas de fuite par durée.
  if (!body.password || !(await secureEqual(body.password, adminKey))) {
    try {
      await logActivity({ agentKey: "system", action: "login_echec", message: `Connexion refusée (${ip})`, level: "warn" });
    } catch { /* non bloquant */ }
    return NextResponse.json({ error: "Clé incorrecte" }, { status: 401 });
  }

  // Session signée : le cookie ne transporte QUE le token, jamais la clé.
  const sid = crypto.randomUUID();
  const token = await signSession(sid);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Piste d'audit en base : hash du token, IP, user-agent. Best-effort —
  // une panne d'audit ne doit pas empêcher une connexion valide.
  try {
    await db.insert(sessions).values({
      tokenHash: await hashToken(token),
      ip,
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
      expiresAt,
    });
  } catch { /* non bloquant */ }
  try {
    await logActivity({ agentKey: "system", action: "login_ok", message: `Session ouverte (${ip})`, level: "success" });
  } catch { /* non bloquant */ }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
