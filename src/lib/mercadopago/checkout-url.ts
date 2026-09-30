// Mercado Pago (and Mercado Libre) domains, with their country suffixes
// (.com, .com.br, .cl, ...). Anchored so lookalikes such as
// `mercadopago.com.br.evil.com` never match.
const providerHostPattern =
  /(^|\.)(mercadopago|mercadolibre)\.(com(\.[a-z]{2})?|[a-z]{2})$/;

/**
 * Whether `value` is a Mercado Pago checkout address: https, no credentials,
 * default port and a Mercado Pago host. Anything a browser saved must pass this
 * before the buyer is sent there.
 */
export function isMercadoPagoCheckoutUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.port === "" &&
    providerHostPattern.test(url.hostname)
  );
}
