import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

async function updateExpiredVouchers() {
  const now = new Date();
  try {
    // Find all vouchers that have expired
    const expiredVouchers = await prisma.voucher.findMany({
      where: {
        expires_at: {
          lte: now,
        },
        valid: true,
      },
    });

    // Update each expired voucher
    for (const voucher of expiredVouchers) {
      await prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          valid: false,
          status: "expired",
        },
      });
    }
  } catch (error) {
    console.error("Error updating expired vouchers:", error);
  }
}

// async function deleteExpiredInvalidVouchers() {
//   const now = new Date();
//   try {
//     // Find all vouchers that have expired
//     const expiredVouchers = await prisma.voucher.findMany({
//       where: {
//         expires_at: {
//           lte: now,
//         },
//         valid: false,
//       },
//     });

//     // Delete each expired voucher
//     for (const voucher of expiredVouchers) {
// }

export async function GET(req: Request) {
  if (
    req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    await updateExpiredVouchers();
  } catch (error) {
    console.error("Error updating expired vouchers:", error);
  }
}
