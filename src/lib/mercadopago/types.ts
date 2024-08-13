import { z } from "zod";

export const PaymentSchema = z.object({
  collection_id: z.string(),
  collection_status: z.string(),
  payment_id: z.string(),
  status: z.string(),
  external_reference: z.string(),
  payment_type: z.string(),
  merchant_order_id: z.string(),
  preference_id: z.string(),
  site_id: z.string(),
  processing_mode: z.string(),
  merchant_account_id: z.string(),
});

const itemSchema = z.object({
  id: z.string(),
  currency_id: z.string(),
  title: z.string(),
  picture_url: z.string().url(),
  description: z.string(),
  quantity: z.number().int(),
  unit_price: z.number(),
});

// Define the payer schema
const payerSchema = z.object({
  phone: z.object({
    number: z.string(),
  }),
  address: z.object({
    zip_code: z.string(),
    street_name: z.string(),
    street_number: z.number().int(),
  }),
  identification: z.object({
    number: z.number().int(),
    type: z.enum(["DNI", "Other"]),
  }),
});

// Define the main schema
const preferenceSchema = z.object({
  auto_return: z.literal("approved"),
  back_urls: z.record(z.unknown()),
  client_id: z.number().int(),
  collector_id: z.number().int(),
  date_approved: z.string().date(),
  date_of_expiration: z.string().date(),
  payments: z.object({
    id: z.string(),
  }),
  date_created: z.string().date(),
  expiration_date_from: z.string().date(),
  expiration_date_to: z.string().date(),
  id: z.string(),
  init_point: z.string().url(),
  items: z.array(itemSchema),
  marketplace: z.string(),
  marketplace_fee: z.number(),
  statement_descriptor: z.string(),
  payer: payerSchema,
  payment_methods: z.object({
    excluded_payment_methods: z.array(z.unknown()),
    excluded_payment_types: z.array(z.unknown()),
  }),
  sandbox_init_point: z.string().url(),
  shipments: z.object({
    receiver_address: z.record(z.unknown()),
  }),
});

export const webhookSchema = z.object({
  action: z.string(),
  api_version: z.string(),
  data: z.object({
    id: z.string(),
  }),
  date_created: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format",
  }),
  id: z.string(),
  live_mode: z.boolean(),
  type: z.string(),
  user_id: z.number(),
});

export type Payment = z.infer<typeof PaymentSchema>;
export type PreferenceSchema = z.infer<typeof preferenceSchema>;
export type WebhookType = z.infer<typeof webhookSchema>;
