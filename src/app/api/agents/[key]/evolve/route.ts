import { NextResponse, type NextRequest } from "next/server";
import { evolveAgent } from "@/lib/agent-brain";
import { ensureAgentsSeeded } from "@/lib/agents";
import { notifyTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ key: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  await ensureAgentsSeeded();
  const result = await evolveAgent(key);
  if (result.ok && (result.skills.length || result.learnings.length)) {
    await notifyTelegram(
      `🧬 <b>${key.toUpperCase()} a évolué</b>\n${result.summary}` +
        (result.skills.length ? `\n\nNouvelles compétences : ${result.skills.join(", ")}` : ""),
    );
  }
  return NextResponse.json(result);
}
