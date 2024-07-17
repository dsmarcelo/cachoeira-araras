import { z } from "zod";

const VoucherStatus = z.enum(["pending", "valid", "redeemed", "expired"]);

export const voucherSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatorio")
    .max(100, "Nome deve ser menor que 100 caracteres"),
  phone: z.string().trim(),
  adults: z.coerce
    .number()
    .gte(0, "Quantidade inválida")
    .lte(20, "No maximo 20 pessoas")
    .int(),
  elderly: z.coerce
    .number()
    .gte(0, "Quantidade inválida")
    .lte(20, "No maximo 20 pessoas")
    .int(),
  code: z.string(),
  price: z.number(),
  valid: z.boolean(),
  status: VoucherStatus,
  preference_id: z.string(),
  expires_at: z.union([z.date(), z.null()]).optional(),
});

export type VoucherSchema = z.infer<typeof voucherSchema>;

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
      .lte(20, "No maximo 20 pessoas")
      .int(),
    elderly: z.coerce
      .number({
        required_error: "Campo obrigatório",
        invalid_type_error: "Deve ser um número",
      })
      .gte(0, "Quantidade inválida")
      .lte(20, "No maximo 20 pessoas")
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

export const initialVoucherSchema = z.object({
  name: z.string(),
  phone: z.string(),
  adults: z.coerce.number().gte(0).lte(10),
  elderly: z.coerce.number().gte(0).lte(10),
  preference_id: z.string(),
});
