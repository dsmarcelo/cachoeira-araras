import * as crypto from 'crypto';
import { type PaymentResponse } from 'mercadopago/dist/clients/payment/commonTypes';
import { env } from '../../env';

// Facebook Pixel configuration from environment variables
const PIXEL_ID = env.FACEBOOK_PIXEL_ID;
const ACCESS_TOKEN = env.FACEBOOK_ACCESS_TOKEN;

// Types for Facebook Pixel events
interface FacebookPixelEvent {
  event_name: string;
  event_time: number;
  action_source: string;
  user_data: {
    em?: string;
  };
  custom_data: {
    currency: string;
    value: number;
    transaction_id: string;
  };
}

interface FacebookPixelPayload {
  data: FacebookPixelEvent[];
}

// Types for Google Ads conversion events (using Google Analytics Measurement Protocol)
interface GoogleAdsConversionPayload {
  client_id: string;
  events: {
    name: string;
    params: {
      transaction_id: string;
      value: number;
      currency: string;
      items: Array<{
        item_id: string;
        item_name: string;
        currency: string;
        price: number;
        quantity: number;
      }>;
    };
  }[];
}

/**
 * Sends a Google Ads conversion event using Google Analytics Measurement Protocol
 * @param payment - The MercadoPago payment response object
 * @returns Promise<boolean> - True if the event was sent successfully, false otherwise
 */
export async function sendGoogleAdsConversion(payment: PaymentResponse): Promise<boolean> {
  try {
    // Check if payment is approved
    if (payment.status !== 'approved') {
      console.log('Payment not approved, skipping Google Ads conversion');
      return false;
    }

    // Generate a client ID (using payment ID as a unique identifier)
    const clientId = payment.id?.toString() ?? Math.random().toString();

    // Build the Google Analytics 4 conversion payload
    const payload: GoogleAdsConversionPayload = {
      client_id: clientId,
      events: [{
        name: 'purchase',
        params: {
          transaction_id: payment.id?.toString() ?? '',
          value: payment.transaction_amount ?? 0,
          currency: 'BRL',
          items: [{
            item_id: 'voucher',
            item_name: 'Voucher Cachoeira das Araras',
            currency: 'BRL',
            price: payment.transaction_amount ?? 0,
            quantity: 1
          }]
        }
      }]
    };

    // Send to Google Analytics 4 Measurement Protocol
    const measurementId = env.GOOGLE_ANALYTICS_MEASUREMENT_ID;
    const apiSecret = env.GOOGLE_ANALYTICS_API_SECRET;

    if (!apiSecret || !measurementId) {
      console.log('Google Analytics configuration missing, skipping Google Analytics conversion');
      return false;
    }

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Analytics conversion API error:', response.status, errorText);
      return false;
    }

    console.log('Google Analytics conversion sent successfully');
    return true;

  } catch (error: unknown) {
    console.error('Error sending Google Analytics conversion:', String(error));
    return false;
  }
}

/**
 * Sends a Facebook Pixel conversion event when a payment is approved
 * @param payment - The MercadoPago payment response object
 * @returns Promise<boolean> - True if the event was sent successfully, false otherwise
 */
export async function sendFacebookPixelEvent(payment: PaymentResponse): Promise<boolean> {
  try {
    // Validate environment variables
    if (!PIXEL_ID || !ACCESS_TOKEN) {
      console.error('Facebook Pixel configuration missing: PIXEL_ID or ACCESS_TOKEN not set');
      return false;
    }

    // Check if payment is approved and has payer email
    if (payment.status !== 'approved' || !payment.payer?.email) {
      console.log('Payment not approved or missing payer email, skipping Facebook Pixel event');
      return false;
    }

    // Create SHA256 hash of the email (normalized to lowercase and trimmed)
    const emailHash = crypto
      .createHash('sha256')
      .update(payment.payer.email.trim().toLowerCase())
      .digest('hex');

    // Build the Facebook Pixel event
    const evento: FacebookPixelPayload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: {
          em: emailHash
        },
        custom_data: {
          currency: 'BRL',
          value: payment.transaction_amount ?? 0,
          transaction_id: payment.id?.toString() ?? ''
        }
      }]
    };

    // Send the event to Facebook Conversions API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(evento),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Facebook Pixel API error:', response.status, errorText);
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: Record<string, unknown> = await response.json();
    console.log('Facebook Pixel event sent successfully:', result);

    return true;

  } catch (error: unknown) {
    console.error('Error sending Facebook Pixel event:', String(error));
    return false;
  }
}
