import { db } from "@/db";
import { activities } from "@/db/schema";

export async function logActivity(params: {
  agentKey: string;
  action: string;
  message: string;
  level?: "info" | "success" | "warn" | "error";
  prospectId?: number | null;
  meta?: Record<string, unknown>;
}) {
  const rows = await db
    .insert(activities)
    .values({
      agentKey: params.agentKey,
      action: params.action,
      message: params.message,
      level: params.level ?? "info",
      prospectId: params.prospectId ?? null,
      meta: params.meta ?? null,
    })
    .returning();
  return rows[0];
}
