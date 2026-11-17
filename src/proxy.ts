import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  secureEqual,
  shouldRenewSession,
  signSession,
  verifySession,
} from "@/lib/auth";

// Routes appelées par des machines, protégées par leur propre secret :
// - /api/cron/tick      → Authorization: Bearer CRON_SECRET (Vercel Cron)
// - /api/cron/heavy     → Authorization: Bearer CRON_SECRET (cron externe)
// - /api/telegram/webhook → header x-telegram-bot-api-secret-token
// - /api/webhooks/whop  → ?secret=CRON_SECRET (URL configurée dans Whop)
// - /api/webhooks/email → ?secret=EMAIL_WEBHOOK_SECRET (Worker Cloudflare)
// Routes de tracking des emails : publiques par design (ce sont les clics des
// destinataires), sécurisées par le token unique de chaque email.
// /api/site-form : formulaires des sites clients (v6) — visiteurs publics,
// protégé par honeypot + rate limit + validation stricte côté route.
const PUBLIC_PREFIXES = [
  "/api/cron/tick",
  "/api/cron/heavy",
  "/api/telegram/webhook",
  "/api/webhooks/whop",
  "/api/webhooks/email",
  "/api/track/open",
  "/api/track/click",
  "/api/site-form",
  "/api/login",
];

// Les machines (scripts d'exploitation) continuent d'utiliser la clé admin en
// header — les headers ne fuient pas dans les logs/referers contrairement aux
// query strings. Le cookie, lui, ne porte plus JAMAIS la clé brute : c'est un
// token signé vérifié ci-dessous (src/lib/auth.ts).
async function machineAuthorized(req: NextRequest, adminKey: string): Promise<boolean> {
  const key = req.headers.get("x-admin-key");
  const auth = req.headers.get("authorization");
  const provided = key || (auth?.startsWith("Bearer ") ? auth.slice(7) : "");
  if (!provided) return false;
  return secureEqual(provided, adminKey);
}

export async function proxy(req: NextRequest) {
  const adminKey = process.env.ADMIN_KEY || "";
  // Gracieuse dégradation : sans ADMIN_KEY configurée, l'app reste ouverte
  // (usage personnel). La protection s'active dès que la variable existe.
  if (!adminKey) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // 1) Session signée (cookie) — vérification edge-safe, sans DB.
  const cookieToken = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(cookieToken);

  // 2) Repli machines : x-admin-key / Bearer ADMIN_KEY en header.
  if (!session && (await machineAuthorized(req, adminKey))) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // 3) Renouvellement glissant : session de plus de 12 h → nouveau token
  // (même sid), la session ne meurt jamais en plein travail tant qu'on agit.
  if (shouldRenewSession(session)) {
    const token = await signSession(session.sid);
    const res = NextResponse.next();
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tout sauf assets statiques Next, favicon et fichiers avec extension
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
