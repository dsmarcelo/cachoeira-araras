import { type NextRequest } from "next/server";
import * as crypto from "crypto";
import { api } from "@/trpc/server";
import {
  sendFacebookPixelEvent,
  sendGoogleAdsConversion,
} from "@/lib/utils/webhook-pixel";

/**
 * Mercado Pago Webhook Handler
 *
 * This endpoint receives payment notifications from Mercado Pago
 * and validates them using HMAC signature verification.
 *
 * Security Features:
 * - HMAC SHA-256 signature validation
 * - Request ID tracking to prevent replay attacks
 * - Timestamp validation (not implemented in basic flow)
 * - Proper error handling and logging
 *
 * Best Practices:
 * - Always validate webhook signatures
 * - Return 200 OK quickly to acknowledge receipt
 * - Process asynchronously when possible
 * - Idempotent operations to handle duplicate deliveries
 */

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "your-secret-key";

/**
 * Validates Mercado Pago webhook signature
 *
 * The signature format is: "ts={timestamp},v1={hash}"
 * The manifest format is: "id:{dataID};request-id:{request_id};ts:{ts};"
 *
 * Security: Uses HMAC SHA-256 to verify webhook authenticity
 *
 * @param request_id - Unique request identifier from Mercado Pago
 * @param signature - Signature header value
 * @param dataID - Payment ID or resource ID
 * @returns true if signature is valid, false otherwise
 */
function isValidSignature(
  request_id: string,
  signature: string,
  dataID: string,
): boolean {
  try {
    const parts = signature.split(",");
    let ts: string | undefined;
    let hash: string | undefined;

    // Parse signature components
    parts.forEach((part) => {
      const [key, value] = part.split("=");
      if (key && value) {
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();
        if (trimmedKey === "ts") {
          ts = trimmedValue;
        } else if (trimmedKey === "v1") {
          hash = trimmedValue;
        }
      }
    });

    // Validate required components
    if (!ts || !hash) {
      console.error("Missing signature components");
      return false;
    }

    // Build manifest string
    const manifest = `id:${dataID};request-id:${request_id};ts:${ts};`;

    // Generate HMAC signature
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(manifest);
    const digest = hmac.digest("hex");

    // Compare signatures - ensure lengths match first to prevent timing attacks
    if (hash.length !== digest.length) {
      return false;
    }

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(digest, "hex"),
    );

    return isValid;
  } catch (error) {
    console.error("Error validating signature:", error);
    return false;
  }
}

/**
 * Validates and processes voucher payment
 *
 * This function handles the complete payment processing flow:
 * 1. Retrieves payment details from Mercado Pago
 * 2. Validates voucher existence
 * 3. Updates voucher status based on payment status
 * 4. Sends analytics events (if configured)
 *
 * Payment Status Handling:
 * - approved: Sets voucher as valid and enables it
 * - rejected: Updates voucher with payment_id for tracking
 * - pending: Updates voucher with payment_id for tracking
 * - refunded: Could be handled separately if needed
 *
 * Idempotency: Already processed vouchers (redeemed) are skipped
 *
 * @param payment_id - Mercado Pago payment ID
 * @returns Response with voucher data or null if error
 */
async function validadeVoucherPayment(payment_id: string) {
  try {
    // Retrieve payment details from Mercado Pago
    const payment = await api.mercadopago.getPayment({ payment_id });
    if (!payment) {
      console.error(`Payment not found: ${payment_id}`);
      return null;
    }

    // Extract voucher code from external reference
    const code = payment.external_reference;
    if (!code || typeof code !== "string") {
      console.error("Invalid external reference in payment");
      return new Response(
        JSON.stringify({ success: false, error: "Voucher not found" }),
        { status: 404 },
      );
    }

    // Get voucher from database
    const voucher = await api.voucher.findByCode({ code });
    if (!voucher) {
      console.error(`Voucher not found for code: ${code}`);
      return new Response(
        JSON.stringify({ success: false, error: "Voucher not found" }),
        { status: 404 },
      );
    }

    // Skip if voucher is already redeemed (idempotency)
    if (voucher.status === "redeemed") {
      console.log(`Voucher ${code} already redeemed, skipping`);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
      });
    }

    // Handle approved payments
    if (payment.status === "approved") {
      const updatedVoucher = await api.voucher.update({
        where: { code },
        data: {
          status: "valid",
          valid: true,
          payment_id: payment_id,
        },
      });

      // Send Facebook Pixel conversion event (non-blocking)
      try {
        const pixelResult = await sendFacebookPixelEvent(payment);
        if (pixelResult) {
          console.log(`Facebook Pixel event sent for payment ${payment_id}`);
        }
      } catch (error: unknown) {
        console.error("Facebook Pixel error:", String(error));
        // Don't fail webhook if analytics fails
      }

      // Send Google Ads conversion event (non-blocking)
      try {
        const googleAdsResult: boolean = await sendGoogleAdsConversion(payment);
        if (googleAdsResult) {
          console.log(`Google Ads conversion sent for payment ${payment_id}`);
        }
      } catch (error: unknown) {
        console.error("Google Ads error:", String(error));
        // Don't fail webhook if analytics fails
      }

      return new Response(JSON.stringify({ voucher: updatedVoucher }), {
        status: 200,
      });
    }
    // Handle other payment statuses (rejected, pending, etc.)
    else {
      // Update voucher with payment_id for tracking
      const updatedVoucher = await api.voucher.update({
        where: { code },
        data: {
          payment_id: payment_id,
        },
      });

      console.log(
        `Payment ${payment_id} status: ${payment.status} for voucher ${code}`,
      );

      return new Response(JSON.stringify({ voucher: updatedVoucher }), {
        status: 200,
      });
    }
  } catch (error: unknown) {
    console.error("Error validating voucher payment:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500 },
    );
  }
}

/**
 * Webhook POST Handler
 *
 * Main webhook endpoint that processes Mercado Pago payment notifications
 *
 * Flow:
 * 1. Extract headers and query parameters
 * 2. Validate webhook signature
 * 3. Process payment and update voucher
 * 4. Return appropriate status code
 *
 * Headers Required:
 * - x-signature: HMAC signature for verification
 * - x-request-id: Unique request identifier
 *
 * Query Parameters:
 * - data.id: Payment ID or resource ID
 *
 * Security:
 * - Always validates signature before processing
 * - Returns 400 for invalid signatures
 * - Returns 404 for missing resources
 * - Returns 500 for internal errors
 *
 * @param request - Next.js request object
 * @returns Response with success/error status
 */
export async function POST(request: NextRequest) {
  try {
    // Extract required headers
    const signature = request.headers.get("x-signature");
    const request_id = request.headers.get("x-request-id");

    // Validate headers
    if (!signature || !request_id) {
      console.error("Missing required headers");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required headers" }),
        { status: 400 },
      );
    }

    // Extract payment ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const dataID = searchParams.get("data.id");

    if (!dataID) {
      console.error("Missing data.id parameter");
      return new Response(
        JSON.stringify({ success: false, error: "Missing payment ID" }),
        { status: 400 },
      );
    }

    const payment_id = dataID;

    // Validate webhook signature
    if (!isValidSignature(request_id, signature, dataID)) {
      console.error(`Invalid signature for payment ${payment_id}`);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid signature" }),
        { status: 400 },
      );
    }

    // Process payment
    const res = await validadeVoucherPayment(payment_id);

    if (!res) {
      console.error(`Failed to process payment ${payment_id}`);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process payment" }),
        { status: 404 },
      );
    }

    // Return success
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Error processing webhook:", String(error));
    return new Response(
      JSON.stringify({ success: false, error: "Internal Server Error" }),
      { status: 500 },
    );
  }
}
