export function formatVoucherStatus(status: string) {
  if (!status) return <p className="text-red-500">Voucher inválido</p>;
  switch (status) {
    case "pending":
      return <p className="text-yellow-500">Aguardando pagamento</p>;
    case "valid":
      return <p className="text-green-500">Voucher válido</p>;
    case "redeemed":
      return <p className="text-red-300">Voucher já resgatado</p>;
    case "expired":
      return <p className="text-slate-500">Voucher expirado</p>;
    default:
      return <p className="text-red-500">Voucher inválido</p>;
  }
}
