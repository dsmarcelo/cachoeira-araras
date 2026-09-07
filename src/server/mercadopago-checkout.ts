const webhookPath = "/api/webhook";

/** Strip trailing slashes so generated Mercado Pago URLs never double slashes. */
export function normalizePublicBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

/**
 * Validates that a configured base URL is exactly an origin — protocol and
 * host, no path/query/hash. `buildMercadoPagoWebhookUrl` resolves the webhook
 * path against this base with `new URL(path, base)`, which silently drops
 * any path already present in `base`; failing loudly here instead of letting
 * that happen is the whole point of this check.
 */
export function assertOriginOnlyUrl(value: string, envVarName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `${envVarName} inválida: "${value}" não é uma URL absoluta válida.`,
    );
  }

  if ((parsed.pathname !== "" && parsed.pathname !== "/") || parsed.search || parsed.hash) {
    throw new Error(
      `${envVarName} deve conter apenas a origem (protocolo e domínio), sem caminho, query ou hash: "${value}".`,
    );
  }

  return normalizePublicBaseUrl(value);
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
    return assertOriginOnlyUrl(explicitWebhookUrl, "WEBHOOK_URL");
  }

  return assertOriginOnlyUrl(siteBaseUrl, "URL");
}

export function buildMercadoPagoWebhookUrl(webhookBase: string): string {
  const url = new URL(webhookPath, `${normalizePublicBaseUrl(webhookBase)}/`);
  url.searchParams.set("source_news", "webhooks");

  return url.toString();
}
