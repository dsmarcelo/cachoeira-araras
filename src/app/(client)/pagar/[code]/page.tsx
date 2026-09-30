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
    <main className="bg-page px-4 py-8 md:py-12">
      <EmbeddedCheckout
        code={decodeURIComponent(code)}
        publicKey={env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY}
      />
    </main>
  );
}
