import { describe, expect, it } from "vitest";

import { createVoucherFormSchema } from "./types";
import { addDaysToDateKey, getSaoPauloDateKey } from "../utils/date";

const MAX_INTENDED_DAYS = 60;
const validPhone = "11912345678";

function buildData(overrides: Record<string, unknown> = {}) {
  const today = getSaoPauloDateKey();
  return {
    name: "Visitante",
    phone: validPhone,
    adults: 1,
    intendedDate: new Date(`${today}T12:00:00-03:00`),
    ...overrides,
  };
}

const schema = createVoucherFormSchema(MAX_INTENDED_DAYS);

describe("visit date window", () => {
  it("rejects a visit date in the past", () => {
    const yesterday = addDaysToDateKey(getSaoPauloDateKey(), -1);
    const result = schema.safeParse(
      buildData({ intendedDate: new Date(`${yesterday}T12:00:00-03:00`) }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts today, in the São Paulo timezone", () => {
    expect(schema.safeParse(buildData()).success).toBe(true);
  });

  it("accepts the exact max.intended.days boundary and rejects one day beyond", () => {
    const maxDay = addDaysToDateKey(getSaoPauloDateKey(), MAX_INTENDED_DAYS);
    const beyondMaxDay = addDaysToDateKey(maxDay, 1);

    expect(
      schema.safeParse(
        buildData({ intendedDate: new Date(`${maxDay}T12:00:00-03:00`) }),
      ).success,
    ).toBe(true);
    expect(
      schema.safeParse(
        buildData({ intendedDate: new Date(`${beyondMaxDay}T12:00:00-03:00`) }),
      ).success,
    ).toBe(false);
  });
});

describe("simultaneous field errors", () => {
  it("reports name, phone, and date errors together on an empty submission", () => {
    const result = schema.safeParse({
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
    const result = schema.safeParse(buildData({ name: "", phone: "123" }));

    expect(result.success).toBe(false);
    if (result.success) return;

    const paths = result.error.issues.map((issue) => issue.path[0]);
    expect(paths).toContain("phone");
    expect(paths).toContain("name");
  });
});

describe("phone format", () => {
  it("rejects phone numbers missing the DDD + 9 prefix", () => {
    expect(schema.safeParse(buildData({ phone: "1199999999" })).success).toBe(
      false,
    );
  });

  it("accepts phone numbers with DDD and the leading 9", () => {
    expect(schema.safeParse(buildData({ phone: "21988887777" })).success).toBe(
      true,
    );
  });
});
