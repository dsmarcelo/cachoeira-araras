import { z } from "zod";

export const voucherFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nome é obrigatorio")
      .max(40, "Nome deve ser menor que 40 caracteres"),
    phone: z.string().trim(),
    peopleQty: z.coerce
      .number()
      .gte(1, "Quantidade inválida")
      .lte(10, "No maximo 10 pessoas")
      .int(),
  })
  .refine(
    (data) => {
      return data.phone.length >= 11 && data.phone.charAt(2) === "9";
    },
    {
      message:
        "Número incorreto, não se esqueça de colocar o DDD e o 9 no início",
      path: ["phone"],
    },
  );

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
    peopleQty: data.peopleQty,
    valid: true,
  };
  return completeData;
}
