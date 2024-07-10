import { z } from "zod";

export type Voucher = {
  name: string;
  phone: string;
  code: string;
  peopleQty: number;
  valid: boolean;
};

export const voucherSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatorio")
    .max(100, "Nome deve ser menor que 100 caracteres"),
  phone: z.string().trim(),
  peopleQty: z.coerce
    .number()
    .gte(1, "Quantidade inválida")
    .lte(10, "No maximo 10 pessoas")
    .int(),
  code: z.string(),
  valid: z.boolean(),
});
