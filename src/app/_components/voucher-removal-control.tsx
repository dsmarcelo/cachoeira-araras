import DeleteVoucherCookieBtn from "./delete-voucher-cookie-btn";

export default function VoucherRemovalControl({
  code,
  hasIncompleteRefund,
}: {
  code: string;
  hasIncompleteRefund: boolean;
}) {
  if (hasIncompleteRefund) {
    return (
      <p className="text-xs text-amber-300">
        Reembolso em processamento não pode ser removido deste navegador.
      </p>
    );
  }

  return <DeleteVoucherCookieBtn code={code} />;
}
