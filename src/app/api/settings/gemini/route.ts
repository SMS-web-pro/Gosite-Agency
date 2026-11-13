import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/bootstrap";
import { testGeminiKeys } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/settings/gemini — micro-appel (64 tokens) par clé configurée :
// dit précisément quel compte Gemini répond et quel compte est piégé.
export async function GET() {
  await ensureSchema();
  const probe = await testGeminiKeys();
  return NextResponse.json({ probe });
}
