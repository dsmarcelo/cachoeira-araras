export const dynamic = "force-dynamic";
import { env } from "@/env";
import { db } from "@/server/db";
import { NextResponse } from "next/server";

function getSaoPauloNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
}

async function updateExpiredVouchers(now: Date) {
  const result = await db.voucher.updateMany({
    where: {
      expires_at: {
        lte: now,
      },
      valid: true,
      status: "valid",
      deletedAt: null,
    },
    data: {
      valid: false,
      status: "expired",
    },
  });

  return result.count;
}

async function deleteExpiredPendingVouchers(now: Date) {
  const result = await db.voucher.updateMany({
    where: {
      expires_at: {
        lte: now,
      },
      valid: false,
      status: "pending",
      deletedAt: null,
    },
    data: {
      deletedAt: now,
    },
  });

  return result.count;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }
  console.log("Running cron job");

  try {
    const now = getSaoPauloNow();
    const expiredVouchers = await updateExpiredVouchers(now);
    const softDeletedPendingVouchers = await deleteExpiredPendingVouchers(now);

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
