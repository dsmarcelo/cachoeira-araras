export async function formatVoucherStatus(status: string) {
  if (!status) return "Voucher inválido";
  switch (status) {
    case "pending":
      return "Aguardando pagamento";
    case "valid":
      return "Voucher válido";
    case "redeemed":
      return "Voucher já resgatado";
    case "expired":
      return "Voucher expirado";
    default:
      return "Voucher inválido";
  }
}
