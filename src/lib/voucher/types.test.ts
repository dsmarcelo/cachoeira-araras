import { describe, expect, it, vi } from "vitest";

// `@/env` validates real process env vars at import time, which aren't
// available in the test environment and are irrelevant to schema validation.
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_MAX_INTENDED_DAYS: 30 },
}));

const { voucherFormSchema } = await import("./types");

const validSubmission = {
  name: "Maria Silva",
  phone: "11999999999",
  adults: 2,
  intendedDate: new Date(),
};

describe("voucherFormSchema", () => {
  it("accepts a valid submission", () => {
    const result = voucherFormSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it("reports name, phone, and date errors together on an empty submission", () => {
    const result = voucherFormSchema.safeParse({
      name: "",
      phone: "",
      adults: 1,
      intendedDate: undefined,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const paths = result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(["name", "phone", "intendedDate"]),
    );
  });

  it("flags an invalid phone even when other fields are also invalid", () => {
    const result = voucherFormSchema.safeParse({
      ...validSubmission,
      name: "",
      phone: "123",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    const paths = result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toContain("phone");
    expect(paths).toContain("name");
  });

  it("rejects phone numbers missing the DDD + 9 prefix", () => {
    const result = voucherFormSchema.safeParse({
      ...validSubmission,
      phone: "1199999999",
    });
    expect(result.success).toBe(false);
  });

  it("accepts phone numbers with DDD and the leading 9", () => {
    const result = voucherFormSchema.safeParse({
      ...validSubmission,
      phone: "21988887777",
    });
    expect(result.success).toBe(true);
  });
});
