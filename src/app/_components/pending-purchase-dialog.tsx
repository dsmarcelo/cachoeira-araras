"use client";

import React from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api as convexApi } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { formatQuantity, formatVoucherStatus } from "@/lib/voucher";
import { formatPhone } from "@/lib/utils";
import {
  readVouchers,
  touchFinancialEvent,
} from "@/lib/voucher/browser-storage";
import { Loader2 } from "lucide-react";
import Link from "next/link";

interface PendingPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  managementTokens: string[];
  onResume?: (code: string) => void;
  onCancel?: (code: string) => void;
}

function formatDate(dateKey: string) {
  const parts = dateKey.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateKey;
}

function formatTerminalExplanation(status: string) {
  switch (status) {
    case "cancelled":
      return "Esta compra foi cancelada e não pode mais ser paga.";
    case "expired":
      return "Esta compra expirou e não pode mais ser paga.";
    case "refunded":
      return "Esta compra foi estornada e não pode mais ser paga.";
    case "redeemed":
      return "Este voucher já foi resgatado.";
    default:
      return "Esta compra está finalizada e não pode mais ser alterada.";
  }
}

export default function PendingPurchaseDialog({
  open,
  onOpenChange,
  phone,
  managementTokens,
  onResume,
  onCancel,
}: PendingPurchaseDialogProps) {
  const router = useRouter();
  const resumePaymentMutation = useMutation(convexApi.vouchers.resumePayment);
  const cancelPurchaseAction = useAction(
    convexApi.vouchers.cancelPendingPurchase,
  );
  const [resumingCode, setResumingCode] = React.useState<string | null>(null);
  const [confirmingCancelCode, setConfirmingCancelCode] = React.useState<
    string | null
  >(null);
  const [cancellingCode, setCancellingCode] = React.useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [queryTime, setQueryTime] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!open) return;
    setQueryTime(Date.now());
    const interval = window.setInterval(() => setQueryTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [open]);

  const conflict = useQuery(
    convexApi.vouchers.getPendingConflict,
    open && phone ? { phone, managementTokens, now: queryTime } : "skip",
  );

  async function handleResume(code: string) {
    try {
      setResumingCode(code);
      setErrorMessage(null);

      let token = "";
      let savedInitPoint: string | undefined;
      if (typeof window !== "undefined") {
        const saved = readVouchers(localStorage);
        const match = saved.find((v) => v.code === code);
        if (match?.managementToken) {
          token = match.managementToken;
        }
        savedInitPoint = match?.initPoint;
      }
      const firstFallback = managementTokens[0];
      if (!token && firstFallback) {
        token = firstFallback;
      }

      if (!token) {
        throw new Error(
          "Não foi possível encontrar a autorização desta compra neste navegador.",
        );
      }

      const result = await resumePaymentMutation({
        code,
        managementToken: token,
        savedInitPoint,
      });

      if (result.kind === "resumed") {
        window.location.assign(result.checkoutUrl);
        return;
      }

      if (result.kind === "already_paid") {
        router.push(result.redirectUrl);
        return;
      }

      if (result.kind === "terminal") {
        setErrorMessage(result.message);
      }
      onResume?.(code);
    } catch {
      setErrorMessage(
        "Não foi possível verificar o pagamento agora. Tente novamente em instantes.",
      );
    } finally {
      setResumingCode(null);
    }
  }

  async function handleCancel(code: string) {
    try {
      setCancellingCode(code);
      setErrorMessage(null);

      let token = "";
      if (typeof window !== "undefined") {
        const saved = readVouchers(localStorage);
        const match = saved.find((v) => v.code === code);
        if (match?.managementToken) {
          token = match.managementToken;
        }
      }
      const firstFallback = managementTokens[0];
      if (!token && firstFallback) {
        token = firstFallback;
      }

      if (!token) {
        throw new Error(
          "Não foi possível encontrar a autorização desta compra neste navegador.",
        );
      }

      const result = await cancelPurchaseAction({
        code,
        managementToken: token,
      });

      if (result.kind === "cancelled" || result.kind === "already_cancelled") {
        if (typeof window !== "undefined") {
          touchFinancialEvent(localStorage, code, { eventAt: Date.now() });
        }
        setConfirmingCancelCode(null);
        onCancel?.(code);
        return;
      }

      if (result.kind === "already_approved") {
        if (typeof window !== "undefined") {
          touchFinancialEvent(localStorage, code, { eventAt: Date.now() });
        }
        setConfirmingCancelCode(null);
        router.push(result.redirectUrl);
        return;
      }

      setErrorMessage(result.message);
    } catch {
      setErrorMessage(
        "Não foi possível cancelar a compra agora. Tente novamente em instantes.",
      );
    } finally {
      setCancellingCode(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-surface text-fg sm:max-w-lg">
        {conflict === undefined ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-fg-muted" />
            <p className="mt-2 text-sm text-fg-subtle">
              Verificando compras pendentes...
            </p>
          </div>
        ) : conflict.kind === "generic" ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-fg">
                Compra pendente encontrada
              </DialogTitle>
              <DialogDescription className="text-sm text-fg-subtle">
                Identificamos uma compra em andamento para o telefone{" "}
                {formatPhone(phone)}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-scrim/20 p-4 text-sm leading-relaxed text-fg-muted">
              <p>
                Para sua segurança, os detalhes e ações desta compra só estão
                disponíveis no navegador onde ela foi iniciada.
              </p>
              <p className="mt-2">
                Acesse o site através do dispositivo e navegador original para
                concluir o pagamento ou cancelar o pedido pendente.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="inverseOutline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Entendi
              </Button>
            </div>
          </div>
        ) : conflict.kind === "authorized" ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-fg">
                {conflict.vouchers.length > 1
                  ? "Compras pendentes encontradas"
                  : "Compra pendente encontrada"}
              </DialogTitle>
              <DialogDescription className="text-sm text-fg-subtle">
                Você já possui{" "}
                {conflict.vouchers.length > 1 ? "compras" : "uma compra"} para o
                telefone {formatPhone(phone)}. Escolha uma ação abaixo:
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <Notice tone="danger" role="alert">
                {errorMessage}
              </Notice>
            )}

            <div className="space-y-4">
              {conflict.vouchers.map((voucher) => (
                <div
                  key={voucher.code}
                  className="space-y-3 rounded-xl border border-line/10 bg-scrim/30 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold tracking-wide text-fg-subtle">
                      Código:{" "}
                      <span className="font-mono text-base font-bold text-fg">
                        {voucher.code}
                      </span>
                    </span>
                    <div>{formatVoucherStatus(voucher.status)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-fg-muted">
                    <div>
                      <p className="text-xs text-fg-faint">Data da visita</p>
                      <p className="font-medium text-fg">
                        {formatDate(voucher.visitDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-fg-faint">Valor</p>
                      <p className="font-medium text-fg">
                        R${" "}
                        {(voucher.priceCents / 100)
                          .toFixed(2)
                          .replace(".", ",")}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-fg-faint">Entradas</p>
                      <p className="font-medium text-fg">
                        {formatQuantity({
                          adults: voucher.adults,
                          elderly: voucher.elderly,
                          adults_pool: voucher.adultsPool,
                          elderly_pool: voucher.elderlyPool,
                        })}
                      </p>
                    </div>
                  </div>

                  {voucher.status === "valid" ? (
                    <Notice tone="success" className="border-0 p-2 text-center text-xs">
                      Pagamento aprovado! Este voucher já está válido.
                      <div className="mt-2">
                        <Button
                          asChild
                          size="sm"
                          variant="cta"
                          className="w-full"
                        >
                          <Link
                            href={`/pagamento?external_reference=${voucher.code}`}
                          >
                            Ver voucher
                          </Link>
                        </Button>
                      </div>
                    </Notice>
                  ) : voucher.status !== "pending" ? (
                    <Notice tone="neutral" className="p-2 text-center text-xs">
                      {formatTerminalExplanation(voucher.status)}
                    </Notice>
                  ) : confirmingCancelCode === voucher.code ? (
                    <Notice tone="danger" className="space-y-2">
                      <p className="font-medium">
                        Deseja realmente cancelar esta compra pendente?
                      </p>
                      <p className="text-xs">
                        Esta ação liberará seu telefone para uma nova compra. O
                        link de pagamento atual será desativado.
                      </p>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          variant="inverseGhost"
                          size="sm"
                          disabled={cancellingCode === voucher.code}
                          onClick={() => setConfirmingCancelCode(null)}
                          className="text-xs"
                        >
                          Voltar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={cancellingCode === voucher.code}
                          onClick={() => handleCancel(voucher.code)}
                          className="text-xs"
                        >
                          {cancellingCode === voucher.code ? (
                            <>
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Cancelando...
                            </>
                          ) : (
                            "Confirmar cancelamento"
                          )}
                        </Button>
                      </div>
                    </Notice>
                  ) : (
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                      {voucher.actions.canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={
                            cancellingCode === voucher.code ||
                            resumingCode === voucher.code
                          }
                          onClick={() => setConfirmingCancelCode(voucher.code)}
                          className="rounded-lg border-danger/40 bg-transparent text-danger-text hover:bg-danger/20 hover:text-danger-text"
                        >
                          Cancelar compra
                        </Button>
                      )}
                      {voucher.actions.canResume && (
                        <Button
                          size="sm"
                          variant="cta"
                          disabled={
                            resumingCode === voucher.code ||
                            cancellingCode === voucher.code
                          }
                          onClick={() => handleResume(voucher.code)}
                          className="rounded-lg"
                        >
                          {resumingCode === voucher.code ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Verificando...
                            </>
                          ) : (
                            "Finalizar pagamento"
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="inverseGhost"
                onClick={() => onOpenChange(false)}
                className="text-sm"
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-fg">
                Nenhuma compra pendente
              </DialogTitle>
              <DialogDescription className="text-sm text-fg-subtle">
                Não há compras pendentes bloqueando este telefone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end pt-2">
              <Button
                variant="cta"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Continuar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
