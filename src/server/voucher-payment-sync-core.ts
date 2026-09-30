import type { Voucher } from "@prisma/client";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import type {
  ConfirmVoucherPaymentInput,
  VoucherPaymentResult,
} from "./voucher-payment-confirmation.ts";

type SyncResult = {
  voucher: Voucher;
  payment: PaymentResponse | null;
  syncError: "unavailable" | "invalid_payment" | null;
};

export async function syncDisplayedVoucherPage(
  vouchers: Voucher[],
  dependencies: {
    sync: (voucher: Voucher) => Promise<SyncResult>;
    reload: (ids: number[]) => Promise<Voucher[]>;
  },
) {
  if (!vouchers.length) return { items: [], syncWarning: null };
  const results = await Promise.all(
    vouchers.map((voucher) => dependencies.sync(voucher)),
  );
  // One bounded database reread keeps concurrent redemption/deletion visible.
  const current = new Map(
    (await dependencies.reload(vouchers.map((voucher) => voucher.id))).map(
      (voucher) => [voucher.id, voucher],
    ),
  );
  return {
    items: vouchers.flatMap((voucher) => {
      const item = current.get(voucher.id);
      return item && !item.deletedAt ? [item] : [];
    }),
    syncWarning: results.some((result) => result.syncError !== null)
      ? "Não foi possível atualizar todos os pagamentos. Tente novamente em instantes."
      : null,
  };
}

type Dependencies = {
  getPayment: (id: string) => Promise<PaymentResponse | null>;
  searchPayments: (code: string) => Promise<
    Array<{
      id: string;
      status: string | null;
      externalReference: string | null;
    }>
  >;
  confirmPayment: (
    input: ConfirmVoucherPaymentInput,
  ) => Promise<VoucherPaymentResult>;
  sendConversionEvents: (payment: PaymentResponse, id: string) => Promise<void>;
  onError: (error: unknown, code: string) => void;
  now?: () => number;
};

export function createVoucherPaymentSync(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  const inFlight = new Map<string, Promise<SyncResult>>();
  const recent = new Map<
    string,
    { checkedAt: number; syncError: SyncResult["syncError"] }
  >();
  const queue: Array<() => void> = [];
  let active = 0;

  async function acquire() {
    if (active >= 3) await new Promise<void>((resolve) => queue.push(resolve));
    else active += 1;
  }

  function release() {
    const next = queue.shift();
    if (next) next();
    else active -= 1;
  }

  async function run(
    voucher: Voucher,
    paymentId?: string,
  ): Promise<SyncResult> {
    const unchanged: SyncResult = { voucher, payment: null, syncError: null };
    await acquire();
    try {
      const knownId = paymentId ?? voucher.payment_id;
      let payment = knownId ? await dependencies.getPayment(knownId) : null;
      if (paymentId && payment?.external_reference !== voucher.code) {
        return { ...unchanged, syncError: "invalid_payment" };
      }
      if (
        payment?.external_reference !== undefined &&
        payment.external_reference !== voucher.code
      ) {
        return { ...unchanged, syncError: "invalid_payment" };
      }
      // A rejected/old attempt does not rule out a subsequent approved one.
      if (voucher.status === "pending" && payment?.status !== "approved") {
        const matches = await dependencies.searchPayments(voucher.code);
        const approved = matches.filter(
          (item) =>
            item.status === "approved" &&
            item.externalReference === voucher.code,
        );
        if (approved.length > 1) {
          dependencies.onError(
            new Error("Multiple approved payments for voucher"),
            voucher.code,
          );
        }
        const candidate = approved[0];
        if (candidate) payment = await dependencies.getPayment(candidate.id);
      }
      if (payment?.status !== "approved") return { ...unchanged, payment };
      if (
        payment.external_reference !== voucher.code ||
        payment.currency_id !== "BRL" ||
        typeof payment.transaction_amount !== "number" ||
        Math.round(payment.transaction_amount * 100) !==
          Math.round(voucher.price * 100) ||
        !payment.id
      ) {
        dependencies.onError(
          new Error("Payment does not match voucher"),
          voucher.code,
        );
        return { ...unchanged, syncError: "invalid_payment" };
      }
      const id = String(payment.id);
      const result = await dependencies.confirmPayment({
        code: voucher.code,
        paymentId: id,
        paymentStatus: payment.status,
      });
      if (result.shouldSendConversionEvents) {
        try {
          await dependencies.sendConversionEvents(payment, id);
        } catch (error) {
          dependencies.onError(error, voucher.code);
        }
      }
      return { ...unchanged, voucher: result.voucher ?? voucher, payment };
    } catch (error) {
      dependencies.onError(error, voucher.code);
      return { ...unchanged, syncError: "unavailable" };
    } finally {
      release();
    }
  }

  return async function sync(
    voucher: Voucher,
    paymentId?: string,
    fresh = false,
  ): Promise<SyncResult> {
    const unchanged: SyncResult = { voucher, payment: null, syncError: null };
    if (voucher.deletedAt || (voucher.status !== "pending" && !paymentId))
      return unchanged;
    // An explicit checkout-return payment bypasses the negative-result cooldown,
    // so a check made before payment cannot delay the customer's approval.
    const key = `${voucher.id}:${paymentId ?? voucher.payment_id ?? "search"}`;
    const existing = inFlight.get(key);
    if (existing) return await existing;
    const last = recent.get(key);
    if (
      !fresh &&
      !paymentId &&
      last &&
      now() - last.checkedAt < (last.syncError ? 5_000 : 30_000)
    ) {
      return { ...unchanged, syncError: last.syncError };
    }
    const task = run(voucher, paymentId);
    inFlight.set(key, task);
    try {
      const result = await task;
      if (recent.size >= 1_000) {
        const oldestKey = recent.keys().next().value;
        if (oldestKey) recent.delete(oldestKey);
      }
      recent.set(key, { checkedAt: now(), syncError: result.syncError });
      return result;
    } finally {
      inFlight.delete(key);
    }
  };
}
