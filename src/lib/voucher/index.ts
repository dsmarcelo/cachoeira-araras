export function formatVoucherStatus(status: string) {
  if (!status) return "Voucher inválido";
  switch (status) {
    case "pending":
      return "Aguardando confirmação";
    case "valid":
      return "Voucher válido";
    case "redeemed":
      return "Voucher resgatado";
    case "expired":
      return "Voucher expirado";
    default:
      return "Voucher inválido";
  }
}
