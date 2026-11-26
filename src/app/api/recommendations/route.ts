import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getDashboardOverview } from "@/lib/dashboard/service";

export async function GET() {
  const session = await getCurrentSession();
  const overview = await getDashboardOverview("month", session?.workshopId);
  return NextResponse.json({
    dataSource: overview.dataSource,
    recommendations: overview.actionLogs,
  });
}
