import { env } from "@/env";
import { createGetnetPaymentProvider } from "./providers/getnet";
import { createMercadoPagoPaymentProvider } from "./providers/mercadopago";

export interface PaymentRequest {
  code: string;
  title: string;
  description: string;
  unitPrice: number;
  quantity: number;
  buyer: {
    name: string;
    surname: string;
    phone: string;
  };
  metadata?: Record<string, string | number | boolean>;
}

export interface PaymentCreationResponse {
  preferenceId: string;
  paymentLink: string;
  raw: unknown;
}

export interface PaymentStatusResponse {
  status: string;
  paymentId?: string;
  provider: "mercadopago" | "getnet";
  raw?: unknown;
}

export interface PaymentProvider {
  createPayment(request: PaymentRequest): Promise<PaymentCreationResponse>;
  getPaymentStatus(reference: string): Promise<PaymentStatusResponse | null>;
}

export function createPaymentProvider(): PaymentProvider {
  const provider = env.PAYMENT_PLATFORM;

  if (provider === "getnet") {
    return createGetnetPaymentProvider();
  }

  return createMercadoPagoPaymentProvider();
}

