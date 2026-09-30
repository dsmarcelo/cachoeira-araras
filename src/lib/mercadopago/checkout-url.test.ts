import { describe, expect, it } from "vitest";

import { isMercadoPagoCheckoutUrl } from "./checkout-url";

describe("isMercadoPagoCheckoutUrl", () => {
  it.each([
    "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1-2",
    "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=1-2",
    "https://www.mercadopago.com/checkout/v1/redirect",
    "https://www.mercadopago.com.ar/checkout/v1/redirect",
    "https://www.mercadolibre.com/checkout/v1/redirect",
  ])("accepts %s", (url) => {
    expect(isMercadoPagoCheckoutUrl(url)).toBe(true);
  });

  it.each([
    "http://www.mercadopago.com.br/checkout",
    "https://mercadopago.com.br.evil.com/checkout",
    "https://evil.com/?u=www.mercadopago.com.br",
    "https://notmercadopago.com.br/checkout",
    "https://user:pw@www.mercadopago.com.br/checkout",
    "https://www.mercadopago.com.br:8443/checkout",
    "javascript:alert(1)",
    "/pagar/ABC123",
    "",
  ])("refuses %s", (url) => {
    expect(isMercadoPagoCheckoutUrl(url)).toBe(false);
  });
});
