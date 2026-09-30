import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";

import { requireStaff } from "@/app/lib";

import VoucherBuyTest from "../../_components/voucher-buy-test";
import { PageShell } from "../_components/admin-ui";

/**
 * The one predictable place staff buy an R$0,01 voucher to exercise the real
 * Mercado Pago path (credentials, webhook signature, notification URL) end
 * to end. Test-mode pricing and the resulting voucher's Test
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
    <PageShell className="max-w-2xl">
      <div
        role="note"
        className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-900"
      >
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
        <div className="flex flex-col gap-1 text-[13px] leading-relaxed">
          <span className="text-sm font-semibold">Pagamento real de R$ 0,01</span>
          <span>
            Passa pelo Mercado Pago de verdade para testar pagamento e confirmação. O voucher
            sai marcado como teste e não aparece nas listas nem nos relatórios.
          </span>
        </div>
      </div>
      {/* The public purchase form in test mode, so it keeps the site's own look. */}
      <VoucherBuyTest />
    </PageShell>
  );
}
