import { expect, test } from "vitest";

import { addDaysToDateKey, getSaoPauloDateKey } from "./date";

test("getSaoPauloDateKey returns the São Paulo calendar day for a given instant", () => {
  const noonInSaoPaulo = new Date("2026-04-26T12:00:00-03:00");
  expect(getSaoPauloDateKey(noonInSaoPaulo)).toBe("2026-04-26");
});

test("getSaoPauloDateKey stays on the São Paulo day even when UTC (and a timezone east of Greenwich) has already rolled to the next day", () => {
  // 2026-04-27T10:00:00+09:00 (Tokyo, UTC+09:00) is 2026-04-27T01:00:00Z in UTC,
  // which is still 2026-04-26T22:00:00-03:00 in São Paulo. A naive
  // `toISOString().slice(0, 10)` conversion (the old, buggy approach) would
  // report the UTC day, "2026-04-27" — one day ahead of the correct São Paulo
  // day. This pins the São Paulo-timezone-based key so that regression can't
  // reappear silently.
  const tokyoInstant = new Date("2026-04-27T10:00:00+09:00");
  expect(tokyoInstant.toISOString().slice(0, 10)).toBe("2026-04-27");
  expect(getSaoPauloDateKey(tokyoInstant)).toBe("2026-04-26");
});

test("addDaysToDateKey adds and subtracts days across month boundaries", () => {
  expect(addDaysToDateKey("2026-04-30", 1)).toBe("2026-05-01");
  expect(addDaysToDateKey("2026-05-01", -1)).toBe("2026-04-30");
  expect(addDaysToDateKey("2026-04-26", 60)).toBe("2026-06-25");
});
