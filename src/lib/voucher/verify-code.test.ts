import { describe, expect, it } from "vitest";
import { sanitizeVoucherCode } from "./verify-code";

describe("sanitizeVoucherCode", () => {
  it("lowercases and drops characters outside a-z0-9", () => {
    expect(sanitizeVoucherCode(" AB-c 1!")).toBe("abc1");
  });

  it("keeps at most 6 characters", () => {
    expect(sanitizeVoucherCode("ABCDEFGH")).toBe("abcdef");
  });

  it("returns an empty string when nothing valid is left", () => {
    expect(sanitizeVoucherCode("--- ")).toBe("");
  });
});
