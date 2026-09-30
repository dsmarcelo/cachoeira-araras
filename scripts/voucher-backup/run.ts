import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { decodeBackup, encodeBackup } from "./format.ts";

const batchSize = 500;

async function main() {
  const [command, file, ...extra] = process.argv.slice(2);
  if (
    !file ||
    extra.length > 0 ||
    (command !== "backup" && command !== "restore")
  ) {
    throw new Error(
      "Usage: pnpm vouchers:backup <file.json.gz> | pnpm vouchers:restore <file.json.gz>",
    );
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const destination = path.resolve(file);
  // Reject malformed files before opening a connection or changing the database.
  const backup =
    command === "restore"
      ? await decodeBackup(await readFile(destination))
      : null;
  const prisma = new PrismaClient();
  try {
    if (command === "backup") {
      const snapshot = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET TRANSACTION READ ONLY`;
          const vouchers = await tx.voucher.findMany();
          const referrers = await tx.referrer.findMany();
          return { vouchers, referrers };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: 60_000,
        },
      );
      const bytes = await encodeBackup({
        format: "cachoeira-vouchers-postgres",
        version: 1,
        createdAt: new Date(),
        ...snapshot,
      });
      await mkdir(path.dirname(destination), { recursive: true });
      // Exclusive creation protects previous backups; owner-only access protects customer data.
      await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
      console.log(
        `Saved ${snapshot.vouchers.length} vouchers and ${snapshot.referrers.length} referrers to ${destination} (${bytes.length} bytes).`,
      );
    } else if (backup) {
      await prisma.$transaction(
        async (tx) => {
          // Block concurrent writes between the empty-table check and inserts.
          await tx.$executeRaw`LOCK TABLE "Voucher", "Referrer" IN SHARE ROW EXCLUSIVE MODE`;
          if ((await tx.voucher.count()) || (await tx.referrer.count())) {
            throw new Error(
              "Restore refused: Voucher and Referrer must both be empty. Existing data was not changed.",
            );
          }
          for (let i = 0; i < backup.vouchers.length; i += batchSize) {
            await tx.voucher.createMany({
              data: backup.vouchers.slice(i, i + batchSize),
            });
          }
          for (let i = 0; i < backup.referrers.length; i += batchSize) {
            await tx.referrer.createMany({
              data: backup.referrers.slice(i, i + batchSize),
            });
          }
          // Explicit IDs do not advance Postgres sequences. Keep future inserts collision-free.
          await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('"Voucher"', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM "Voucher"`;
          await tx.$queryRaw`SELECT setval(pg_get_serial_sequence('"Referrer"', 'id'), COALESCE(MAX(id), 1), COUNT(*) > 0) FROM "Referrer"`;
        },
        { timeout: 60_000 },
      );
      console.log(
        `Restored ${backup.vouchers.length} vouchers and ${backup.referrers.length} referrers from ${destination}.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Prisma connection errors can contain connection details; do not print credentials.
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database URL redacted]"),
  );
  process.exitCode = 1;
});
