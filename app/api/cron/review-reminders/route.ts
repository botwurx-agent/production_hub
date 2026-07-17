import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { runReviewReminders } from "@/lib/review-reminders";
import { reportError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily Vercel Cron endpoint. Vercel attaches `Authorization: Bearer <CRON_SECRET>`
// when CRON_SECRET is set, so we reject anything without it.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!serviceConfigured()) {
    return NextResponse.json({ error: "service not configured" }, { status: 503 });
  }
  try {
    const service = createServiceClient();
    const result = await runReviewReminders(service);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    reportError("cron.reviewReminders", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
