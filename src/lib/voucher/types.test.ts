import { expect, test } from "vitest";

import { createVoucherFormSchema } from "./types";
import { addDaysToDateKey, getSaoPauloDateKey } from "../utils/date";

const validPhone = "11912345678";

function buildData(intendedDate: Date) {
  return {
    name: "Visitante",
    phone: validPhone,
    adults: 1,
    intendedDate,
  };
}

test("rejects a visit date in the past", () => {
  const schema = createVoucherFormSchema(60);
  const yesterday = addDaysToDateKey(getSaoPauloDateKey(), -1);

  const result = schema.safeParse(
    buildData(new Date(`${yesterday}T12:00:00-03:00`)),
  );

  expect(result.success).toBe(false);
});

test("accepts today, in the São Paulo timezone", () => {
  const schema = createVoucherFormSchema(60);
  const today = getSaoPauloDateKey();

  const result = schema.safeParse(
    buildData(new Date(`${today}T12:00:00-03:00`)),
  );

  expect(result.success).toBe(true);
});

test("accepts a date exactly at the max.intended.days window and rejects one day beyond it", () => {
  const maxIntendedDays = 60;
  const schema = createVoucherFormSchema(maxIntendedDays);
  const maxDay = addDaysToDateKey(getSaoPauloDateKey(), maxIntendedDays);
  const beyondMaxDay = addDaysToDateKey(maxDay, 1);

  expect(
    schema.safeParse(buildData(new Date(`${maxDay}T12:00:00-03:00`)))
      .success,
  ).toBe(true);
  expect(
    schema.safeParse(buildData(new Date(`${beyondMaxDay}T12:00:00-03:00`)))
      .success,
  ).toBe(false);
});
