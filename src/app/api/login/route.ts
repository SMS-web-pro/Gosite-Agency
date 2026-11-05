import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminKey = process.env.ADMIN_KEY || "";
  if (!adminKey) {
    return NextResponse.json({ error: "ADMIN_KEY non configurée sur le serveur" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  if (!body.password || body.password !== adminKey) {
    return NextResponse.json({ error: "Clé incorrecte" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("gsd_admin", adminKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
