import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getCookieVoucher } from "@/app/lib";
import { StatusScreen } from "@/app/_components/status-screen";
import PaymentStatus from "./payment-status";

/**
 * The Mercado Pago return page. Every `back_url` on the checkout preference
 * (approved, pending, and failure alike) points here — MP appends
 * `external_reference` (the Voucher Code) to the query string on the way
 * back, which is all this page needs: the actual payment confirmation
 * already happened, or will happen shortly, via the webhook
 * (src/app/api/webhook/route.ts), never here. This page only reflects that
 * state, reactively (see `payment-status.tsx`), so it never needs a reload.
 */
export default async function PaymentStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const externalReference = resolvedSearchParams.external_reference;
  const cookieVoucher = await getCookieVoucher();
  const code =
    typeof externalReference === "string" && externalReference
      ? externalReference
      : (cookieVoucher?.code ?? null);

  if (!code) {
    return (
      <StatusScreen title="Link inválido">
        <Button asChild variant="brand">
          <Link href="/">Voltar para a página inicial</Link>
        </Button>
      </StatusScreen>
    );
  }

  return (
    <PaymentStatus
      code={code}
      initialCookieVoucher={cookieVoucher}
    />
  );
}
