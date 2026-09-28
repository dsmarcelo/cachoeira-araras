/** Provider failure details kept separate from mockable HTTP operations. */
export class MercadoPagoApiError extends Error {
  constructor(
    readonly status: number,
    readonly providerCode?: string,
    readonly providerMessage?: string,
  ) {
    super(`Mercado Pago API failed with ${status}`);
  }
}
