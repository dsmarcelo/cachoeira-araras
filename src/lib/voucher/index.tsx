export function formatVoucherStatus(status: string) {
  if (!status) return <p className="text-red-500">Voucher inválido</p>;
  switch (status) {
    case "pending":
      return <p className="text-yellow-700 w-fit bg-yellow-200/30 rounded-lg px-1 pb-1">Aguardando pagamento</p>
    case "valid":
      return <p className="text-green-500 w-fit bg-green-200/30 rounded-lg px-1 pb-1">Voucher válido</p>;
    case "redeemed":
      return <p className="text-red-500 w-fit bg-red-200/30 rounded-lg px-1 pb-1">Voucher já resgatado</p>;
    case "expired":
      return <p className="text-slate-500 w-fit bg-slate-200/30 rounded-lg px-1 pb-1">Voucher expirado</p>;
    default:
      return <p className="text-red-500 w-fit bg-red-200/30 rounded-lg px-1 pb-1">Voucher inválido</p>;
  }
}
