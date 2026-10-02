import { describe, expect, test } from "vitest";

import { getVisitDateRejection } from "./visit-date";

const todayKey = "2026-04-25";
const customerRules = { maxIntendedDays: 10, disabledDays: ["2026-04-28"] };

describe("getVisitDateRejection", () => {
  test("allows today and the last day of the booking window", () => {
    expect(
      getVisitDateRejection("2026-04-25", { todayKey, rules: customerRules }),
    ).toBeNull();
    expect(
      getVisitDateRejection("2026-05-05", { todayKey, rules: customerRules }),
    ).toBeNull();
  });

  test("rejects a malformed date", () => {
    expect(
      getVisitDateRejection("25/04/2026", { todayKey, rules: customerRules }),
    ).toBe("Data de visita inválida.");
  });

  test("rejects a past day", () => {
    expect(
      getVisitDateRejection("2026-04-24", { todayKey, rules: customerRules }),
    ).toBe("Data de visita não pode estar no passado.");
  });

  test("rejects a day beyond the booking window", () => {
    expect(
      getVisitDateRejection("2026-05-06", { todayKey, rules: customerRules }),
    ).toBe("Data de visita além do limite permitido.");
  });

  test("rejects a closed day", () => {
    expect(
      getVisitDateRejection("2026-04-28", { todayKey, rules: customerRules }),
    ).toBe("Data de visita indisponível.");
  });

  test("admin mode only rejects the past", () => {
    expect(getVisitDateRejection("2027-01-01", { todayKey })).toBeNull();
    expect(getVisitDateRejection("2026-04-28", { todayKey })).toBeNull();
    expect(getVisitDateRejection("2026-04-24", { todayKey })).toBe(
      "Data de visita não pode estar no passado.",
    );
  });
});
