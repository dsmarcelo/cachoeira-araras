import { env } from "@/env";
import { EmbeddedCheckout } from "./embedded-checkout";

/**
 * Internal payment page of an embedded (Bricks) purchase. The Voucher Code in
 * the address only selects the purchase; paying still needs the management
 * token kept by the browser that started it.
 */
export default async function PayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <EmbeddedCheckout
      code={decodeURIComponent(code)}
      publicKey={env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY}
    />
  );
}
