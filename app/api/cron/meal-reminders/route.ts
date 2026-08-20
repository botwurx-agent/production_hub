import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, serviceConfigured } from "@/lib/supabase/service";
import { runMealReminders } from "@/lib/meal-reminders";
import { reportError } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Same guard as the other cron routes, and its own route so a failure here
// cannot take the review or call-sheet reminders down with it.
//
// Runs every fifteen minutes rather than daily: a meal cutoff is a time of day,
// not a date, so a once-a-day job would deliver a 10am order at lunchtime.
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
    const result = await runMealReminders(service);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    reportError("cron.mealReminders", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
