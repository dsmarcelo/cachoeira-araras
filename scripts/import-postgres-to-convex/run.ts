/**
 * Postgres -> Convex import (ticket 14 of the Convex migration).
 *
 * Reads Vouchers, Referrers and Site Settings out of the legacy Postgres
 * database through Prisma, transforms them (see transform.ts), and writes
 * through Convex's `import:importVouchers` / `import:importSettings`
 * internal mutations — never through a public mutation, and never with a
 * client identity.
 *
 * Usage (from the repo root, with DATABASE_URL and Convex CLI config
 * available, e.g. via `.env.local`):
 *
 *   node --env-file=.env.local scripts/import-postgres-to-convex/run.ts
 *
 * Idempotent: re-running reports every already-imported row as "unchanged"
 * (see convex/import.ts) rather than duplicating or overwriting it.
 *
 * Deployment safety: this script never passes `--prod` (or any deployment
 * selector) to the Convex CLI, so `npx convex run` always targets whatever
 * deployment the CLI's own default resolves to — for a developer running
 * this locally, that's `CONVEX_DEPLOYMENT` in `.env.local`. As a second,
 * independent guard, the script refuses to run at all unless that variable
 * is present and starts with "dev:".
 *
 * Postgres safety: `toReadonlyReader` below hands transform code a plain
 * object exposing only the three `findMany` methods this script needs —
 * not the Prisma client itself — so there is no `create`/`update`/`delete`
 * method reachable from anywhere else in this file to begin with. That is
 * enforced by the object literal, not by a type annotation someone could
 * later loosen.
 *
 * Each Convex mutation call runs the Convex CLI's own entry point
 * (node_modules/convex/bin/main.js) directly through `node`, rather than
 * `npx convex`: on Windows, spawning the `npx.cmd`/`convex.cmd` shims
 * without a shell fails outright, and spawning them *through* a shell hands
 * argument quoting to cmd.exe, which mangles a JSON payload containing
 * spaces or quotes. Invoking `node <main.js> ...` is a real executable with
 * an exact argv, so the JSON argument always arrives byte-for-byte on every
 * platform.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PrismaClient,
  type Referrer,
  type SiteSetting,
  type Voucher,
} from "@prisma/client";

import {
  buildSettingImportRow,
  buildVoucherImportRow,
  SettingImportError,
  type SettingImportRow,
  type VoucherImportRow,
} from "./transform.ts";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

// Kept modest because the whole batch is JSON-encoded onto one process's
// argv: a legacy referrer URL can be a multi-kilobyte Mercado Pago redirect
// (with an embedded JWT). Spawning `node <convex CLI>` directly (see the
// file header) avoids the ~8191-char cmd.exe limit, but 10 rows still stays
// comfortably under any platform's argv limit even with an outlier URL in
// the batch, and the dataset this migrates is small (low hundreds of rows).
const BATCH_SIZE = 10;

interface PostgresReader {
  findVouchers(): Promise<Voucher[]>;
  findReferrers(): Promise<Referrer[]>;
  findSiteSettings(): Promise<SiteSetting[]>;
}

/**
 * The ONLY way this script touches Postgres. It hands back a plain object
 * with three read methods bound to the given client — never the client
 * itself — so nothing elsewhere in this file can reach `prisma.voucher.create`,
 * `.update`, or `.delete` even by accident.
 */
function toReadonlyReader(prisma: PrismaClient): PostgresReader {
  return {
    findVouchers: () => prisma.voucher.findMany(),
    findReferrers: () => prisma.referrer.findMany(),
    findSiteSettings: () => prisma.siteSetting.findMany(),
  };
}

function assertTargetingDevDeployment() {
  const deployment = process.env.CONVEX_DEPLOYMENT;
  if (!deployment?.startsWith("dev:")) {
    throw new Error(
      "Refusing to run: CONVEX_DEPLOYMENT is not set to a development " +
        `deployment (got ${JSON.stringify(deployment ?? null)}). This ` +
        "script must only ever be pointed at a dev deployment.",
    );
  }
}

type ImportOutcome = { outcome: "inserted" | "unchanged" };

const convexCliEntryPoint = path.join(
  repoRoot,
  "node_modules",
  "convex",
  "bin",
  "main.js",
);

/**
 * Invokes `convex run <fn> <jsonArgs>` by running the CLI's own entry point
 * under `node`, targeting the CLI's default (dev) deployment. See the file
 * header for why this doesn't go through `npx`/a shell.
 */
function runConvexMutation<T>(functionName: string, args: unknown): T {
  const output = execFileSync(
    process.execPath,
    [convexCliEntryPoint, "run", functionName, JSON.stringify(args)],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return JSON.parse(output) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface Report {
  read: { vouchers: number; referrers: number; siteSettings: number };
  vouchers: { inserted: number; unchanged: number; failed: string[] };
  settings: { inserted: number; unchanged: number; failed: string[] };
}

async function main() {
  assertTargetingDevDeployment();

  const prisma = new PrismaClient();
  const reader = toReadonlyReader(prisma);

  const [legacyVouchers, legacyReferrers, legacySettings] = await Promise.all(
    [reader.findVouchers(), reader.findReferrers(), reader.findSiteSettings()],
  );

  const referrerByVoucherCode = new Map(
    legacyReferrers.map((referrer) => [referrer.voucherCode, referrer]),
  );

  const report: Report = {
    read: {
      vouchers: legacyVouchers.length,
      referrers: legacyReferrers.length,
      siteSettings: legacySettings.length,
    },
    vouchers: { inserted: 0, unchanged: 0, failed: [] },
    settings: { inserted: 0, unchanged: 0, failed: [] },
  };

  const voucherRows: VoucherImportRow[] = [];
  for (const voucher of legacyVouchers) {
    try {
      voucherRows.push(
        buildVoucherImportRow(
          voucher,
          referrerByVoucherCode.get(voucher.code),
        ),
      );
    } catch (error) {
      report.vouchers.failed.push(
        `${voucher.code}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const settingRows: SettingImportRow[] = [];
  for (const setting of legacySettings) {
    try {
      settingRows.push(buildSettingImportRow(setting));
    } catch (error) {
      if (error instanceof SettingImportError) {
        report.settings.failed.push(`${error.key}: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  for (const batch of chunk(voucherRows, BATCH_SIZE)) {
    const results = runConvexMutation<
      Array<{ code: string } & ImportOutcome>
    >("import:importVouchers", { rows: batch });
    for (const result of results) {
      report.vouchers[result.outcome] += 1;
    }
  }

  for (const batch of chunk(settingRows, BATCH_SIZE)) {
    const results = runConvexMutation<Array<{ key: string } & ImportOutcome>>(
      "import:importSettings",
      { rows: batch },
    );
    for (const result of results) {
      report.settings[result.outcome] += 1;
    }
  }

  await prisma.$disconnect();

  console.log("\n=== Postgres -> Convex import report ===");
  console.log(
    `Read from Postgres: ${report.read.vouchers} vouchers, ${report.read.referrers} referrers, ${report.read.siteSettings} site settings`,
  );
  console.log(
    `Vouchers:  ${report.vouchers.inserted} inserted, ${report.vouchers.unchanged} unchanged, ${report.vouchers.failed.length} failed`,
  );
  console.log(
    `Settings:  ${report.settings.inserted} inserted, ${report.settings.unchanged} unchanged, ${report.settings.failed.length} failed`,
  );

  if (report.vouchers.failed.length > 0) {
    console.log("\nVoucher rows skipped:");
    for (const line of report.vouchers.failed) console.log(`  - ${line}`);
  }
  if (report.settings.failed.length > 0) {
    console.log("\nSite Setting rows skipped:");
    for (const line of report.settings.failed) console.log(`  - ${line}`);
  }

  if (report.vouchers.failed.length > 0 || report.settings.failed.length > 0) {
    throw new Error(
      `Import finished with ${report.vouchers.failed.length + report.settings.failed.length} row(s) that could not be converted. See the list above; nothing was silently defaulted or dropped without being reported.`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
