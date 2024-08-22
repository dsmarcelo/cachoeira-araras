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
  status: z.string(),
  preference_id: z.string(),
  payment_id: z.string().optional().nullable(),
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
  adults: z.coerce.number().gte(0).lte(20),
  elderly: z.coerce.number().gte(0).lte(20),
  preference_id: z.string(),
  payment_id: z.string().optional(),
  code: z.string(),
});

export const referrerSchema = z.object({
  voucherCode: z.string(),
  referrer: z.string(),
  url: z.string(),
});

export type ReferrerSchema = z.infer<typeof referrerSchema>;

export const completeVoucherSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string(),
  code: z.string(),
  adults: z.coerce.number().gte(0).lte(20),
  elderly: z.coerce.number().gte(0).lte(20),
  price: z.number(),
  valid: z.boolean(),
  status: z.string(),
  preference_id: z.string(),
  payment_id: z.string().optional(),
  expires_at: z.union([z.date(), z.null()]).optional(),
  referrer: referrerSchema.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CompleteVoucherSchema = z.infer<typeof completeVoucherSchema>;
