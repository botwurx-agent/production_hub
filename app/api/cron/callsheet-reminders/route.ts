import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { runCallSheetReminders } from "@/lib/callsheet-reminders";
import { reportError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily Vercel Cron endpoint, same guard as the review reminders. Kept as its
// own route rather than folded into that one so a failure in either cannot
// take the other down with it.
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
    const result = await runCallSheetReminders(service);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    reportError("cron.callSheetReminders", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
