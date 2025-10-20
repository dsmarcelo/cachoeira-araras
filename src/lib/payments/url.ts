import { env } from '@/env'

/**
 * Build the success URL for a voucher payment across providers.
 * We route Getnet vouchers to the unified `/voucher` page and Mercado Pago
 * retains the legacy query parameters for compatibility with existing UI.
 */
export function buildSuccessUrl(paymentId: string, voucherCode: string): string {
  if (env.PAYMENT_PLATFORM === 'getnet') {
    return `/voucher?code=${voucherCode}&pid=${paymentId}`
  }

  return `/pagamento?collection_id=${paymentId}&collection_status=approved&payment_id=${paymentId}&status=approved&preference_id=${voucherCode}&site_id=MLB&processing_mode=aggregator&merchant_account_id=null`
}
