import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";
import type { DateRangeKey } from "@/lib/mock-dashboard-data";

const VALID_RANGES: readonly DateRangeKey[] = ["month", "week", "today"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRange = searchParams.get("range") ?? "month";
  const range: DateRangeKey = VALID_RANGES.includes(rawRange as DateRangeKey)
    ? (rawRange as DateRangeKey)
    : "month";

  const session = await getCurrentSession();
  const data = await getDashboardOverview(range, session?.workshopId);

  return NextResponse.json(data);
}
