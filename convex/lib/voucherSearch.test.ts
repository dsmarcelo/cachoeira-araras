import { expect, test } from "vitest";

import { normalizeSearch, normalizeSearchQuery, voucherSearchText } from "./voucherSearch";

test("search text is lowercase, accent-free and joins code, name and phone", () => {
  expect(
    voucherSearchText({ code: "AB12cd", name: "José  Conceição", phone: "11999" }),
  ).toBe("ab12cd jose conceicao 11999");
});

test("a mobile phone is also stored without area code and without the leading 9", () => {
  expect(
    voucherSearchText({ code: "4LML", name: "Ana", phone: "5562984524847" }),
  ).toBe("4lml ana 62984524847 984524847 84524847");
});

test("the query side normalizes the same way", () => {
  expect(normalizeSearch("  ÂNGELA ")).toBe("angela");
  expect(normalizeSearchQuery("  ÂNGELA ")).toBe("angela");
});

test("a phone-shaped query collapses to national digits", () => {
  expect(normalizeSearchQuery("(62) 98452-4847")).toBe("62984524847");
  expect(normalizeSearchQuery("+55 62 98452-4847")).toBe("62984524847");
  expect(normalizeSearchQuery("98452")).toBe("98452");
});
