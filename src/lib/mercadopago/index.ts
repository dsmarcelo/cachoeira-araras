export function formatPaymentStatus(status: string): string {
  switch (status) {
    case "approved":
      return "Pagamento Aprovado";
    case "pending":
    case "in_process":
      return "Pagamento Em andamento";
    case "authorized":
      return "Pagamento Autorizado";
    case "rejected":
      return "Pagamento Rejeitado";
    case "cancelled":
      return "Pagamento Cancelado";
    case "refunded":
      return "Pagamento Reembolsado";
    default:
      return "Desconhecido";
  }
}

export function formatPaymentStatusDetail(status: string): string {
  switch (status) {
    case "accredited":
      return "Pagamento creditado na conta";
    case "pending_contingency":
      return "Pagamento em processamento";
    case "pending_review_manual":
      return "Pagamento em analise manual";
    case "cc_rejected_bad_filled_date":
      return "Data de expiração incorreta";
    case "cc_rejected_bad_filled_other":
      return "Dados do cartão incorretos";
    case "cc_rejected_bad_filled_security_code":
      return "CVV incorreto";
    case "cc_rejected_blacklist":
      return "Cartão bloqueado";
    case "cc_rejected_call_for_authorize":
      return "Pagamento requer autorização";
    case "cc_rejected_card_disabled":
      return "Cartão desativado";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado";
    case "cc_rejected_high_risk":
      return "Pagamento rejeitado por prevenção de fraude";
    case "cc_rejected_insufficient_amount":
      return "Valor insuficiente";
    case "cc_rejected_invalid_installments":
      return "Número de parcelas inválido";
    case "cc_rejected_max_attempts":
      return "Excedido o número máximo de tentativas";
    case "cc_rejected_other_reason":
      return "Erro genérico";
    default:
      return "Desconhecido";
  }
}

export function formatPaymentType(payment_type_id: string): string {
  switch (payment_type_id) {
    case "account_money":
      return "Dinheiro na conta";
    case "ticket":
      return "Boleto";
    case "bank_transfer":
      return "Transferência bancária";
    case "atm":
      return "Pagamento em caixa eletrônico";
    case "credit_card":
      return "Cartão de crédito";
    case "debit_card":
      return "Cartão de débito";
    case "prepaid_card":
      return "Cartão pré-pago";
    case "digital_currency":
      return "Compras com Mercado Crédito";
    case "digital_wallet":
      return "Paypal";
    case "voucher_card":
      return "Benefícios Alelo e Sodexo";
    case "crypto_transfer":
      return "Pagamento com criptomoedas";
    default:
      return payment_type_id;
  }
}
