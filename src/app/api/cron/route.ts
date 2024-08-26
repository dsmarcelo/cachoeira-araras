import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

async function updateExpiredVouchers() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  try {
    // Update all expired vouchers in a single query
    await prisma.voucher.updateMany({
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
  } catch (error) {
    console.error("Error updating expired vouchers:", error);
  }
}

async function deleteExpiredPendingVouchers() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  try {
    // Find all vouchers that have expired
    await prisma.voucher.updateMany({
      where: {
        expires_at: {
          lte: now,
        },
        valid: false,
        status: "pending",
      },
      data: {
        deletedAt: now,
      },
    });
  } catch (error) {
    console.error("Error deleting expired vouchers:", error);
  }
}

export async function GET(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  await updateExpiredVouchers();
  await deleteExpiredPendingVouchers();
  return NextResponse.json({ ok: true });
}
