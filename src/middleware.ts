import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "gsd_admin";

// Routes appelées par des machines, protégées par leur propre secret :
// - /api/cron/tick      → Authorization: Bearer CRON_SECRET (Vercel Cron)
// - /api/telegram/webhook → header x-telegram-bot-api-secret-token
// - /api/webhooks/whop  → ?secret=CRON_SECRET (URL configurée dans Whop)
const PUBLIC_PREFIXES = [
  "/api/cron/tick",
  "/api/telegram/webhook",
  "/api/webhooks/whop",
  "/api/login",
];

function authorized(req: NextRequest, adminKey: string): boolean {
  if (req.cookies.get(COOKIE)?.value === adminKey) return true;
  const key = req.headers.get("x-admin-key");
  if (key && key === adminKey) return true;
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${adminKey}`) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const adminKey = process.env.ADMIN_KEY || "";
  // Gracieuse dégradation : sans ADMIN_KEY configurée, l'app reste ouverte
  // (usage personnel). La protection s'active dès que la variable existe.
  if (!adminKey) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  if (authorized(req, adminKey)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Tout sauf assets statiques Next, favicon et fichiers avec extension
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
