import { type z } from "zod";
import { type voucherFormSchema } from "../voucher/types";

type FormSchema = z.infer<typeof voucherFormSchema>;

export function formatPhone(input: string): string {
  let cleanNumber = input.replace(/\D/g, "").substring(0, 11);

  cleanNumber = cleanNumber.replace(/\D/g, "");
  cleanNumber = cleanNumber.replace(/^(\d{2})(\d)/g, "($1) $2");
  cleanNumber = cleanNumber.replace(/(\d)(\d{4})$/, "$1-$2");

  return cleanNumber;
}

export function randomCode(): string {
  let result = "";
  const randomString = Math.random().toString(36).slice(2, 15);
  result += randomString.replace(/[^a-z0-9]/gi, "").substring(0, 4);

  return result;
}

export function formatVoucher(data: FormSchema) {
  const code = randomCode();
  const completeData = {
    name: data.name,
    phone: data.phone,
    code,
    adults: data.adults,
    elderly: data.elderly,
    valid: true,
  };
  return completeData;
}
