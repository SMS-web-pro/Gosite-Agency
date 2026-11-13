import { type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { prospectLightColumns } from "@/db/light";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = [
  "id", "businessName", "businessType", "city", "country", "address", "zip",
  "phone", "email", "emailStatus", "rating", "reviewCount", "hasWebsite",
  "stage", "rejectReason", "deployedUrl", "deployStatus", "paymentStatus",
  "domainUrl", "source", "searchQuery", "contactedAt", "createdAt",
] as const;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const stage = req.nextUrl.searchParams.get("stage");
  const base = db.select(prospectLightColumns).from(prospects);
  const rows = stage
    ? await base.where(eq(prospects.stage, stage)).orderBy(desc(prospects.createdAt))
    : await base.orderBy(desc(prospects.createdAt));

  const header = COLS.join(",");
  const body = rows.map((r) => COLS.map((c) => cell((r as Record<string, unknown>)[c])).join(",")).join("\n");
  const csv = `\uFEFF${header}\n${body}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gosite-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
