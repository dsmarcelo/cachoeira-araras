import { expect, test } from "vitest";

import { normalizeSearch, voucherSearchText } from "./voucherSearch";

test("search text is lowercase, accent-free and joins code, name and phone", () => {
  expect(
    voucherSearchText({ code: "AB12cd", name: "José  Conceição", phone: "11999" }),
  ).toBe("ab12cd jose conceicao 11999");
});

test("the query side normalizes the same way", () => {
  expect(normalizeSearch("  ÂNGELA ")).toBe("angela");
});
