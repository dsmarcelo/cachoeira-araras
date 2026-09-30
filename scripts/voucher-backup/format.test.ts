import assert from "node:assert/strict";
import { test } from "node:test";
import { promisify } from "node:util";
import { gzip } from "node:zlib";
import { decodeBackup, encodeBackup, type Backup } from "./format.ts";

const compress = promisify(gzip);
const timestamp = new Date("2026-09-30T12:00:00.000Z");
function fixture(): Backup {
  return {
    format: "cachoeira-vouchers-postgres",
    version: 1,
    createdAt: timestamp,
    vouchers: [
      {
        id: 42,
        name: "José",
        phone: "11999999999",
        code: "ABC",
        adults: 2,
        elderly: 1,
        adults_pool: 0,
        elderly_pool: 0,
        price: 75.5,
        valid: false,
        status: "pending",
        preference_id: "pref-1",
        payment_id: null,
        expires_at: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    ],
    referrers: [
      {
        id: 7,
        voucherCode: "ABC",
        referrer: "partner",
        url: 'https://example.com/?value="ação"',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  };
}

await test("gzip round trip preserves all fields, IDs, dates, nulls and Unicode", async () => {
  const backup = fixture();
  assert.deepEqual(await decodeBackup(await encodeBackup(backup)), backup);
  backup.vouchers[0]!.payment_id = "paid-1";
  backup.vouchers[0]!.expires_at = null;
  backup.vouchers[0]!.deletedAt = timestamp;
  assert.deepEqual(await decodeBackup(await encodeBackup(backup)), backup);
});

await test("empty tables are valid", async () => {
  const backup = { ...fixture(), vouchers: [], referrers: [] };
  assert.deepEqual(await decodeBackup(await encodeBackup(backup)), backup);
});

await test("rejects duplicate keys and orphan referrers", async () => {
  const backup = fixture();
  const voucher = backup.vouchers[0]!;
  for (const duplicate of [
    { ...voucher, code: "DEF", preference_id: "pref-2" },
    { ...voucher, id: 43, preference_id: "pref-2" },
    { ...voucher, id: 43, code: "DEF" },
  ]) {
    await assert.rejects(
      encodeBackup({ ...backup, vouchers: [voucher, duplicate] }),
      /Duplicate/,
    );
  }
  await assert.rejects(
    encodeBackup({
      ...backup,
      referrers: [{ ...backup.referrers[0]!, voucherCode: "missing" }],
    }),
    /missing voucher/,
  );
  await assert.rejects(
    encodeBackup({
      ...backup,
      referrers: [...backup.referrers, ...backup.referrers],
    }),
    /Duplicate/,
  );
  await assert.rejects(
    encodeBackup({
      ...backup,
      vouchers: [
        { ...voucher, payment_id: "paid-1" },
        {
          ...voucher,
          id: 43,
          code: "DEF",
          preference_id: "pref-2",
          payment_id: "paid-1",
        },
      ],
    }),
    /Duplicate payment ID/,
  );
});

await test("rejects corrupt files, unsupported versions, missing/extra fields and invalid values", async () => {
  await assert.rejects(decodeBackup(Buffer.from("not gzip")));
  const bytes = await encodeBackup(fixture());
  await assert.rejects(decodeBackup(bytes.subarray(0, bytes.length - 8)));
  const serialized = JSON.parse(JSON.stringify(fixture())) as Record<
    string,
    unknown
  >;
  for (const invalid of [
    { ...serialized, version: 2 },
    { ...serialized, referrers: undefined },
    { ...serialized, users: [] },
    { ...serialized, createdAt: "invalid" },
    { ...serialized, vouchers: [{ ...fixture().vouchers[0], id: 1.5 }] },
    { ...serialized, vouchers: [{ ...fixture().vouchers[0], price: null }] },
  ]) {
    await assert.rejects(decodeBackup(await compress(JSON.stringify(invalid))));
  }
});
