import DeleteVoucherCookieBtn from "./delete-voucher-cookie-btn";

export default function VoucherRemovalControl({
  code,
  hasIncompleteRefund,
}: {
  code: string;
  hasIncompleteRefund: boolean;
}) {
  if (hasIncompleteRefund) {
    return null;
  }

  return <DeleteVoucherCookieBtn code={code} />;
}
