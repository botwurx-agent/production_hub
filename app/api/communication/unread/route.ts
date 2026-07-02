import { NextResponse } from "next/server";
import { getStudioContext } from "@/lib/studio";
import { getUnreadTotal } from "@/lib/communication";

export const dynamic = "force-dynamic";

// Client-polled by the sidebar Communication badge. Returns the number of new
// incoming messages across linked conversations. Any failure yields 0 so the
// badge simply hides rather than surfacing an error.
export async function GET() {
  const ctx = await getStudioContext();
  if (!ctx) return NextResponse.json({ total: 0 });
  try {
    const total = await getUnreadTotal();
    return NextResponse.json({ total });
  } catch {
    return NextResponse.json({ total: 0 });
  }
}
