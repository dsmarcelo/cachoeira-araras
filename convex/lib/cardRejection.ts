/**
 * Buyer-facing guidance for a declined card, from Mercado Pago's
 * `status_detail`. Never repeats provider text, so no card or personal data can
 * leak into the message.
 */
export function describeCardRejection(statusDetail: string | undefined) {
  switch (statusDetail) {
    case "cc_rejected_insufficient_amount":
      return "O cartão não tem saldo ou limite suficiente. Use outro cartão ou escolha o Pix.";
    case "cc_rejected_bad_filled_card_number":
    case "cc_rejected_bad_filled_date":
    case "cc_rejected_bad_filled_security_code":
    case "cc_rejected_bad_filled_other":
      return "Algum dado do cartão parece incorreto. Confira número, validade e código de segurança e tente novamente.";
    case "cc_rejected_call_for_authorize":
      return "O banco pede que você autorize este pagamento. Fale com o banco e tente novamente, ou use outro cartão.";
    case "cc_rejected_card_disabled":
      return "Este cartão está desativado. Ative-o com o banco ou use outro cartão.";
    case "cc_rejected_duplicated_payment":
      return "Você já fez um pagamento igual a este. Confira se ele foi aprovado antes de tentar de novo.";
    case "cc_rejected_max_attempts":
      return "Você atingiu o limite de tentativas com este cartão. Use outro cartão ou escolha o Pix.";
    case "cc_rejected_high_risk":
      return "Não foi possível aprovar este pagamento por segurança. Escolha o Pix ou outro meio.";
    case "cc_rejected_invalid_installments":
      return "Este cartão não aceita o número de parcelas escolhido. Escolha outra quantidade de parcelas.";
    case "cc_rejected_3ds_challenge":
    case "cc_rejected_3ds_mandatory":
      return "A verificação do banco não foi concluída. Tente novamente e conclua a autenticação.";
    default:
      return "O pagamento com cartão foi recusado. Confira os dados ou use outro cartão.";
  }
}
