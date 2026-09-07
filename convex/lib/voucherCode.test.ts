import { describe, expect, it, vi } from "vitest";

import { codeAlphabet as crockfordAlphabet, generateVoucherCode } from "./voucherCode";

describe("generateVoucherCode", () => {
  it("is drawn from an alphabet whose length evenly divides 256", () => {
    // The invariant that keeps `byte % alphabet.length` bias-free: every
    // remainder occurs exactly 256 / length times. A future edit to the
    // alphabet that breaks this must fail here, not in production.
    expect(crockfordAlphabet).toHaveLength(32);
    expect(256 % crockfordAlphabet.length).toBe(0);
  });

  it("excludes the visually ambiguous i, l, o, u", () => {
    for (const ambiguous of ["i", "l", "o", "u"]) {
      expect(crockfordAlphabet).not.toContain(ambiguous);
    }
  });

  it("produces a six-character code using only alphabet characters", () => {
    const code = generateVoucherCode();
    expect(code).toHaveLength(6);
    for (const char of code) {
      expect(crockfordAlphabet).toContain(char);
    }
  });

  it("maps every possible random byte to an alphabet character with no bias", () => {
    // Stub getRandomValues to fill the whole array with one fixed byte value
    // per call, so each of the 256 possible byte values feeds every position
    // in the code identically and the resulting distribution can be asserted
    // directly instead of sampled statistically.
    let byteValue = 0;
    const getRandomValues = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation(((array: Uint8Array) => {
        array.fill(byteValue);
        return array;
      }) as typeof crypto.getRandomValues);

    const counts = new Map<string, number>();
    for (byteValue = 0; byteValue < 256; byteValue += 1) {
      const code = generateVoucherCode();
      const char = code[0]!;
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }

    expect(counts.size).toBe(crockfordAlphabet.length);
    for (const char of crockfordAlphabet) {
      expect(counts.get(char)).toBe(8);
    }

    getRandomValues.mockRestore();
  });
});
