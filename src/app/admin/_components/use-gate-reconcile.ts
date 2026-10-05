"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export type GateReconcileState = "checking" | "settled" | "failed";

/**
 * Runs the fresh payment check (`reconcileAtGate`) once per code per mount.
 * "Usar voucher" waits while `checking`; `failed` only shows a notice and
 * never blocks, because `redeemByCode` stays the authority. The voucher
 * query updates reactively, so the result value is not needed here.
 */
export function useGateReconcile(code: string): GateReconcileState {
  const reconcile = useAction(api.voucherReconciliation.reconcileAtGate);
  const [result, setResult] = useState<{ code: string; state: "settled" | "failed" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    reconcile({ code })
      .then((outcome) => {
        if (!cancelled) setResult({ code, state: outcome === "failed" ? "failed" : "settled" });
      })
      .catch(() => {
        if (!cancelled) setResult({ code, state: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [reconcile, code]);

  return result?.code === code ? result.state : "checking";
}

export const gateReconcileFailedMessage = "Não foi possível confirmar o pagamento agora.";

/** Neutral employee-facing label for a flagged payment issue. */
export function paymentIssueLabel(kind: "dispute" | "partial_refund") {
  return kind === "dispute" ? "Pagamento em contestação" : "Reembolso parcial";
}
