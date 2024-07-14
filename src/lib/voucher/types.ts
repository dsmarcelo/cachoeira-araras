import { z } from "zod";

export const voucherSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatorio")
    .max(100, "Nome deve ser menor que 100 caracteres"),
  phone: z.string().trim(),
  adults: z.coerce
    .number()
    .gte(0, "Quantidade inválida")
    .lte(10, "No maximo 10 pessoas")
    .int(),
  elderly: z.coerce
    .number()
    .gte(0, "Quantidade inválida")
    .lte(10, "No maximo 10 pessoas")
    .int(),
  code: z.string(),
  valid: z.boolean(),
  price: z.number(),
});

export type Voucher = z.infer<typeof voucherSchema>;

export const voucherFormSchema = z
  .object({
    name: z
      .string()
      .min(1, "Nome é obrigatorio")
      .max(40, "Nome deve ser menor que 40 caracteres"),
    phone: z.string().trim(),
    adults: z.coerce
      .number({
        required_error: "Campo obrigatório",
        invalid_type_error: "Deve ser um número",
      })
      .gte(0, "Quantidade inválida")
      .lte(10, "No maximo 10 pessoas")
      .int(),
    elderly: z.coerce
      .number({
        required_error: "Campo obrigatório",
        invalid_type_error: "Deve ser um número",
      })
      .gte(0, "Quantidade inválida")
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
