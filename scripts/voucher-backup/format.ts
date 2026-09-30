import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { z } from "zod";

const compress = promisify(gzip);
const decompress = promisify(gunzip);
const integer = z.number().int().min(-2147483648).max(2147483647);
const id = integer.positive();
const date = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const voucherSchema = z
  .object({
    id,
    name: z.string(),
    phone: z.string(),
    code: z.string(),
    adults: integer,
    elderly: integer,
    adults_pool: integer,
    elderly_pool: integer,
    price: z.number().finite(),
    valid: z.boolean(),
    status: z.string(),
    preference_id: z.string(),
    payment_id: z.string().nullable(),
    expires_at: date.nullable(),
    createdAt: date,
    updatedAt: date,
    deletedAt: date.nullable(),
  })
  .strict();

const referrerSchema = z
  .object({
    id,
    voucherCode: z.string(),
    referrer: z.string(),
    url: z.string(),
    createdAt: date,
    updatedAt: date,
  })
  .strict();

const backupSchema = z
  .object({
    format: z.literal("cachoeira-vouchers-postgres"),
    version: z.literal(1),
    createdAt: date,
    vouchers: z.array(voucherSchema),
    referrers: z.array(referrerSchema),
  })
  .strict()
  .superRefine((backup, context) => {
    function unique(values: Array<string | number>, field: string) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate ${field}`,
        });
      }
    }
    unique(
      backup.vouchers.map((row) => row.id),
      "voucher ID",
    );
    unique(
      backup.vouchers.map((row) => row.code),
      "voucher code",
    );
    unique(
      backup.vouchers.map((row) => row.preference_id),
      "preference ID",
    );
    unique(
      backup.vouchers.flatMap((row) =>
        row.payment_id === null ? [] : [row.payment_id],
      ),
      "payment ID",
    );
    unique(
      backup.referrers.map((row) => row.id),
      "referrer ID",
    );
    unique(
      backup.referrers.map((row) => row.voucherCode),
      "referrer voucher code",
    );
    const codes = new Set(backup.vouchers.map((row) => row.code));
    if (backup.referrers.some((row) => !codes.has(row.voucherCode))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Referrer references a missing voucher",
      });
    }
  });

export type Backup = z.output<typeof backupSchema>;

export async function encodeBackup(backup: Backup): Promise<Buffer> {
  const json = JSON.stringify(backup);
  // Validate our own output too, so schema drift cannot silently create unusable backups.
  backupSchema.parse(JSON.parse(json));
  return compress(json);
}

export async function decodeBackup(bytes: Buffer): Promise<Backup> {
  return backupSchema.parse(
    JSON.parse((await decompress(bytes)).toString("utf8")),
  );
}
