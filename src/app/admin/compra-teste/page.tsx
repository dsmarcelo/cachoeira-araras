import { redirect } from "next/navigation";

import { requireStaff } from "@/app/lib";

import VoucherBuyTest from "../../_components/voucher-buy-test";

/**
 * The one predictable place staff buy an R$0,01 voucher to exercise the real
 * Mercado Pago path (production credentials, webhook signature, notification
 * URL) end to end. Test-mode pricing and the resulting voucher's Test
 * Voucher flag are both authorised server-side from the caller's verified
 * role (convex/vouchers.ts `startCheckout`) — this page is reachable by any
 * signed-in staff member, matching who can already use test mode there, but
 * a client cannot obtain test pricing without that server-side check passing
 * regardless of what this page renders.
 */
export default async function CompraTestePage() {
  const user = await requireStaff();

  if (!user) {
    redirect("/admin");
  }

  return (
    <main className="flex w-full flex-col items-center px-4 py-4 md:py-8">
      <VoucherBuyTest />
    </main>
  );
}
