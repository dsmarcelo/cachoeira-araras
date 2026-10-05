"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";

import { api } from "../../../../convex/_generated/api";

export type GateReconcileState = "checking" | "settled" | "failed";

/**
 * Client-side safety net above the server's own provider timeout (10s): if the
 * action has not settled by then, Validar moves on as `failed`.
 */
const GATE_RECONCILE_TIMEOUT_MS = 15_000;

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
    // The first of result or timeout wins; the other is ignored.
    let settled = false;
    const settle = (state: "settled" | "failed") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      setResult({ code, state });
    };
    const timer = setTimeout(() => settle("failed"), GATE_RECONCILE_TIMEOUT_MS);
    reconcile({ code })
      .then((outcome) => settle(outcome === "failed" ? "failed" : "settled"))
      .catch(() => settle("failed"));
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [reconcile, code]);

  return result?.code === code ? result.state : "checking";
}

export const gateReconcileFailedMessage = "Não foi possível confirmar o pagamento agora.";

/** Neutral employee-facing label for a flagged payment issue. */
export function paymentIssueLabel(kind: "dispute" | "partial_refund") {
  return kind === "dispute" ? "Pagamento em contestação" : "Reembolso parcial";
}

const providerCodeLabels: Record<string, string> = {
  approved: "Aprovado",
  accredited: "Creditado",
  in_process: "Em análise",
  in_mediation: "Em mediação",
  charged_back: "Contestado pelo titular do cartão (chargeback)",
  partially_refunded: "Reembolsado parcialmente",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

/**
 * Readable Portuguese for a raw Mercado Pago status, status detail or
 * reversal reason shown to staff; unknown codes are shown as received.
 */
export function providerCodeLabel(code: string) {
  return providerCodeLabels[code] ?? code;
}
