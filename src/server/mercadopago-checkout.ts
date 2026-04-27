const webhookPath = "/api/webhook";

/** Strip trailing slashes so generated Mercado Pago URLs never double slashes. */
export function normalizePublicBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

export function resolveWebhookBaseForCheckout({
  siteBaseUrl,
  webhookUrl,
}: {
  siteBaseUrl: string;
  webhookUrl?: string;
}): string {
  const explicitWebhookUrl = webhookUrl?.trim();
  if (explicitWebhookUrl) {
    return normalizePublicBaseUrl(explicitWebhookUrl);
  }

  return normalizePublicBaseUrl(siteBaseUrl);
}

export function buildMercadoPagoWebhookUrl(webhookBase: string): string {
  const url = new URL(webhookPath, `${normalizePublicBaseUrl(webhookBase)}/`);
  url.searchParams.set("source_news", "webhooks");

  return url.toString();
}
