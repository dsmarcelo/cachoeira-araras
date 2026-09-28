/** Stable, admin-facing explanation of a failed refund attempt. */
export function explainRefundFailure(
  httpStatus?: number,
  providerCode?: string,
  providerMessage?: string,
  lastError?: string,
) {
  const detail = `${providerCode ?? ""} ${providerMessage ?? ""}`.toLowerCase();
  if (httpStatus === 401) {
    return detail.includes("unauthorized use of live credentials")
      ? "O Mercado Pago recusou o uso das credenciais de produção neste ambiente. Corrija o Access Token do deployment antes de tentar novamente."
      : "O Mercado Pago recusou a credencial de acesso. Confira o Access Token do deployment antes de tentar novamente.";
  }
  if (httpStatus === 403)
    return "A conta ou a credencial não tem permissão para reembolsar este pagamento. Confira a conta recebedora e as permissões antes de tentar novamente.";
  if (httpStatus === 404)
    return "O pagamento não foi encontrado nesta conta do Mercado Pago. Confira se a credencial pertence à conta que recebeu o pagamento.";
  if (httpStatus === 429)
    return "O Mercado Pago limitou temporariamente as solicitações. Aguarde e tente novamente.";
  if (httpStatus === 400 || httpStatus === 422)
    return "O Mercado Pago rejeitou este reembolso. Confira o estado do pagamento e as regras de reembolso na conta antes de tentar novamente.";
  if (httpStatus && httpStatus >= 500)
    return "O Mercado Pago apresentou uma falha temporária. O reembolso ainda não foi confirmado.";
  if (lastError?.includes("Integral refund was not confirmed"))
    return "A resposta do Mercado Pago não confirmou o valor integral. Confira o valor já devolvido antes de tentar novamente.";
  return "Não foi possível confirmar o reembolso no Mercado Pago. Confira o pagamento antes de tentar novamente.";
}

/** Only provider-supplied, bounded diagnostics reach an authenticated admin. */
export function refundProviderDetail(
  httpStatus?: number,
  providerCode?: string,
  providerMessage?: string,
) {
  if (!httpStatus) return undefined;
  return [
    `Mercado Pago HTTP ${httpStatus}`,
    providerCode,
    providerMessage,
  ].filter(Boolean).join(" · ");
}
