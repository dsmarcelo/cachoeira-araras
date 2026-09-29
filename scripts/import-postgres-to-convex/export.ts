/**
 * Postgres -> JSONL export for Convex's bulk importer.
 *
 * Reads Vouchers and Referrers from the legacy Postgres database (read-only
 * `findMany` calls), transforms them with transform.ts, and writes one file
 * that `npx convex import` loads in a single call. Unlike run.ts, nothing is
 * sent to Convex here, and the bulk importer does not run one mutation per
 * batch, so it uses far less of the free-plan limits.
 *
 * Usage (from the repo root, with DATABASE_URL in `.env.local`):
 *
 *   pnpm export:postgres-to-convex
 *   pnpm exec convex import --table vouchers --append .import-data/vouchers.jsonl
 *
 * Use `--append` on a table that already has vouchers (existing rows are not
 * deduplicated by code, so export only what is missing), or `--replace` to
 * overwrite the table. The output dir is gitignored: it holds customer data.
 *
 * Vouchers without `expires_at` fall back to their creation day and are
 * listed in the output.
 *
 * Nothing is written if any row fails to convert, so a partial file can never
 * be imported by accident.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import { buildVoucherImportRow } from "./transform.ts";

const outDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".import-data",
);
const vouchersFile = path.join(outDir, "vouchers.jsonl");

async function main() {
  const prisma = new PrismaClient();

  try {
    const [legacyVouchers, legacyReferrers] = await Promise.all([
      prisma.voucher.findMany(),
      prisma.referrer.findMany(),
    ]);

    const referrerByVoucherCode = new Map(
      legacyReferrers.map((referrer) => [referrer.voucherCode, referrer]),
    );

    const lines: string[] = [];
    const failed: string[] = [];
    const createdAtFallbacks: string[] = [];
    for (const voucher of legacyVouchers) {
      try {
        const { row, usedCreatedAtFallback } = buildVoucherImportRow(
          voucher,
          referrerByVoucherCode.get(voucher.code),
        );
        if (usedCreatedAtFallback) createdAtFallbacks.push(voucher.code);
        // The bulk importer skips mutations, so `isTest` (server-set in the
        // app; never true for legacy data) must be written here.
        lines.push(JSON.stringify({ ...row, isTest: false }));
      } catch (error) {
        failed.push(
          `${voucher.code}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    console.log(
      `Read from Postgres: ${legacyVouchers.length} vouchers, ${legacyReferrers.length} referrers`,
    );

    if (createdAtFallbacks.length > 0) {
      console.log(
        `\n${createdAtFallbacks.length} voucher(s) had no expires_at; visitDate/expiresAt derived from createdAt:`,
      );
      for (const code of createdAtFallbacks) console.log(`  - ${code}`);
    }

    if (failed.length > 0) {
      console.log("\nVoucher rows that could not be converted:");
      for (const line of failed) console.log(`  - ${line}`);
      throw new Error(
        `${failed.length} row(s) could not be converted; nothing was written.`,
      );
    }

    await mkdir(outDir, { recursive: true });
    await writeFile(vouchersFile, `${lines.join("\n")}\n`);
    console.log(`Wrote ${lines.length} vouchers to ${vouchersFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
