export const dynamic = "force-dynamic";
import { env } from "@/env";
import { db } from "@/server/db";
import { runVoucherMaintenance } from "@/server/voucher-maintenance";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }
  console.log("Running cron job");

  try {
    const { expiredVouchers, softDeletedPendingVouchers } =
      await runVoucherMaintenance((args) => db.voucher.updateMany(args));

    return NextResponse.json({
      success: true,
      expiredVouchers,
      softDeletedPendingVouchers,
    });
  } catch (error) {
    console.error("Error running cron job:", error);

    return NextResponse.json(
      { success: false, error: "Cron maintenance failed" },
      { status: 500 },
    );
  }
}
