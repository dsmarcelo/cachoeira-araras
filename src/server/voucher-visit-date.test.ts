import assert from "node:assert/strict";
import test from "node:test";
import { brazilDateKeyToDate } from "./voucher-expiry.ts";
import { planVisitDateUpdate } from "./voucher-visit-date.ts";

const now = new Date("2026-10-02T15:00:00.000Z");

await test("converts a day key to Brasília midnight", () => {
  assert.equal(
    brazilDateKeyToDate("2026-10-10")?.toISOString(),
    "2026-10-10T03:00:00.000Z",
  );
});

await test("rejects malformed and non-existent days", () => {
  for (const key of ["2026-02-31", "2026-13-01", "10/10/2026", "2026-10-1", ""]) {
    assert.equal(brazilDateKeyToDate(key), null, key);
  }
});

await test("reactivates an expired voucher moved to today or later", () => {
  for (const key of ["2026-10-02", "2026-10-10"]) {
    const visitDate = brazilDateKeyToDate(key)!;
    assert.deepEqual(planVisitDateUpdate({ status: "expired" }, visitDate, now), {
      ok: true,
      data: { expires_at: visitDate, status: "valid", valid: true },
    });
  }
});

await test("keeps the status of a valid voucher moved to the past", () => {
  const visitDate = brazilDateKeyToDate("2026-09-20")!;
  assert.deepEqual(planVisitDateUpdate({ status: "valid" }, visitDate, now), {
    ok: true,
    data: { expires_at: visitDate },
  });
});

await test("keeps an expired voucher expired when the new date is past", () => {
  const visitDate = brazilDateKeyToDate("2026-09-20")!;
  assert.deepEqual(planVisitDateUpdate({ status: "expired" }, visitDate, now), {
    ok: true,
    data: { expires_at: visitDate },
  });
});

await test("does not change the status of pending vouchers", () => {
  const visitDate = brazilDateKeyToDate("2026-10-10")!;
  assert.deepEqual(planVisitDateUpdate({ status: "pending" }, visitDate, now), {
    ok: true,
    data: { expires_at: visitDate },
  });
});

await test("locks redeemed vouchers", () => {
  const visitDate = brazilDateKeyToDate("2026-10-10")!;
  const result = planVisitDateUpdate({ status: "redeemed" }, visitDate, now);
  assert.equal(result.ok, false);
});
