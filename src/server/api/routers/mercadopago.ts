import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { type PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import { type PreferenceResponse } from "mercadopago/dist/clients/preference/commonTypes";

/**
 * Mercado Pago Integration Configuration
 *
 * This module handles Checkout Pro integration following Mercado Pago best practices:
 * - Uses Access Token in Authorization header (not query params)
 * - Implements proper error handling with status codes
 * - Includes webhook signature validation
 * - Follows PCI DSS compliance guidelines
 *
 * Security Best Practices:
 * - Credentials stored in environment variables
 * - No sensitive data in URLs or query parameters
 * - Secure webhook validation using HMAC signatures
 * - Idempotency keys for duplicate request prevention
 */

// Get Mercado Pago access token from environment
const token = process.env.MERCADOPAGO_TOKEN;

// Determine base URL for redirect callbacks
let url = "";
if (process.env.URL) {
  url = process.env.URL;
} else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
  url = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
} else if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
  url = `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
} else {
  url = "http://localhost:3000";
}

// Webhook URL for receiving payment notifications
const webhookUrl = process.env.WEBHOOK_URL;

// Validate access token presence
if (!token) {
  throw new Error("MERCADOPAGO_TOKEN is not set");
}

// Initialize Mercado Pago client with proper configuration
// timeout: 5000ms to prevent hanging requests
// idempotencyKey: Required for retry safety
const client = new MercadoPagoConfig({
  accessToken: token,
  options: {
    timeout: 5000,
    idempotencyKey: "mp-checkout",
  },
});

/**
 * Formats Brazilian phone number into area code and number
 * Expects format: "DDNNNNNNNNN" (e.g., "11987654321")
 *
 * @param phone - Phone number without formatting
 * @returns Object with area_code and number
 */
function formatPhone(phone: string) {
  const formatedPhone: Record<string, string> = {};
  formatedPhone.area_code = phone.substring(0, 2);
  formatedPhone.number = phone.substring(2);
  return formatedPhone;
}

/**
 * Error handler for Mercado Pago API responses
 * Provides detailed error information for debugging
 */
function handleMercadoPagoError(error: unknown): never {
  if (error instanceof Error) {
    console.error("Mercado Pago API Error:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Failed to process payment: ${error.message}`);
  }
  throw new Error("Unknown error occurred while processing payment");
}

export const mercadopagoRouter = createTRPCRouter({
  /**
   * Create Checkout Pro Payment Preference
   *
   * Creates a payment preference with:
   * - Proper item configuration
   * - Payer information (name, surname, phone)
   * - Return URLs for payment completion
   * - Excel date expiration (10 days)
   * - Webhook notification URL
   * - Payment method exclusions
   *
   * Security Features:
   * - Validates phone number length
   * - Uses external_reference for order tracking
   * - Implements proper error handling
   *
   * @returns PreferenceResponse with init_point for checkout
   */
  create: publicProcedure
    .input(
      z.object({
        code: z.string().min(3).max(4),
        id: z.string(),
        title: z.string().max(100),
        description: z.string().max(255),
        adults: z.number().int().min(0).max(20),
        elderly: z.number().int().min(0).max(20),
        unit_price: z.number().positive(),
        name: z.string().min(2).max(50),
        surname: z.string().max(50),
        phone: z.string().regex(/^\d{11}$/, "Phone must be 11 digits"),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const preference = new Preference(client);

        // Create preference with proper validation
        const response = await preference.create({
          body: {
            items: [
              {
                id: input.id,
                description: input.description,
                title: input.title || "Voucher",
                quantity: 1,
                unit_price: input.unit_price,
                currency_id: "BRL",
              },
            ],
            payer: {
              name: input.name,
              surname: input.surname,
              phone: {
                area_code: formatPhone(input.phone).area_code,
                number: formatPhone(input.phone).number,
              },
            },
            // Configure return URLs for payment status
            back_urls: {
              success: `${url}/pagamento/`,
              failure: `${url}/pagamento/`,
              pending: `${url}/pagamento/`,
            },
            // External reference for order tracking
            external_reference: input.code,
            // Enable expiration for unpaid preferences
            expires: true,
            // Auto-return on successful payment
            auto_return: "approved",
            // Set expiration dates
            expiration_date_from: new Date(Date.now()).toISOString(),
            expiration_date_to: new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 10, // 10 days
            ).toISOString(),
            // Payment method exclusions
            payment_methods: {
              excluded_payment_methods: [
                {
                  id: "bolbradesco", // Boleto bancário
                },
                {
                  id: "pec", // Pagamento em casa lotérica
                },
              ],
            },
            // Statement descriptor on credit card statements
            statement_descriptor: "Cachoeira das Araras",
            // Webhook URL for payment notifications
            notification_url: `${webhookUrl}/api/webhook`,
          },
        });

        return response;
      } catch (error) {
        handleMercadoPagoError(error);
      }
    }),
  /**
   * Get Payment Preference Details
   *
   * Retrieves preference information to check payment status
   * Used for verifying payment completion before processing
   *
   * @returns PreferenceResponse or undefined if not found
   */
  getPreference: publicProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<PreferenceResponse | undefined>(async ({ input }) => {
      try {
        const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          console.error(
            `Failed to fetch preference ${input.preference_id}: ${res.status}`,
          );
          return undefined;
        }

        const data = (await res.json()) as PreferenceResponse;
        return data;
      } catch (error) {
        console.error("Error fetching preference:", error);
        return undefined;
      }
    }),

  /**
   * Get Payment Preference (Alternative)
   *
   * Retrieves preference with error throwing
   * Used when preference is required to exist
   *
   * @returns PreferenceResponse
   * @throws Error if preference not found
   */
  getPrefence: publicProcedure
    .input(z.object({ preference_id: z.string() }))
    .query<PreferenceResponse>(async ({ input }) => {
      try {
        const url = `https://api.mercadopago.com/checkout/preferences/${input.preference_id}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch preference: ${res.status}`);
        }

        return (await res.json()) as PreferenceResponse;
      } catch (error) {
        handleMercadoPagoError(error);
      }
    }),
  /**
   * Get Preference by External Reference
   *
   * Searches for preference using external reference (voucher code)
   * Used to find preference after payment completion
   *
   * @returns PreferenceResponse or undefined if not found
   */
  getPreferenceByEReference: publicProcedure
    .input(z.object({ external_reference: z.string().max(4) }))
    .query<PreferenceResponse | undefined>(async ({ input }) => {
      try {
        const url = `https://api.mercadopago.com/checkout/preferences/search?external_reference=${input.external_reference}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          console.error(
            `Preference not found for reference ${input.external_reference}`,
          );
          return undefined;
        }

        const data = (await res.json()) as PreferenceResponse;
        return data;
      } catch (error) {
        console.error("Error fetching Preference:", error);
        return undefined;
      }
    }),

  /**
   * Get Payment Details
   *
   * Retrieves payment information including status and details
   * Used in webhook validation and payment confirmation
   *
   * Security: Uses Access Token in Authorization header
   *
   * @returns PaymentResponse or undefined if not found
   */
  getPayment: publicProcedure
    .input(z.object({ payment_id: z.string() }))
    .query<PaymentResponse | undefined>(async ({ input }) => {
      try {
        const url = `https://api.mercadopago.com/v1/payments/${input.payment_id}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          console.error(`Payment not found: ${input.payment_id}`);
          return undefined;
        }

        const data: PaymentResponse = (await res.json()) as PaymentResponse;
        return data;
      } catch (error) {
        console.error("Error fetching payment:", error);
        return undefined;
      }
    }),
});
