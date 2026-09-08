"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api as convexApi } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatQuantity, formatVoucherStatus } from "@/lib/voucher";
import { formatPhone } from "@/lib/utils";
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

export default function PendingPurchaseDialog({
  open,
  onOpenChange,
  phone,
  managementTokens,
  onResume,
  onCancel,
}: PendingPurchaseDialogProps) {
  const conflict = useQuery(
    convexApi.vouchers.getPendingConflict,
    open && phone ? { phone, managementTokens } : "skip",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-dark-blue text-primary-50 sm:max-w-lg">
        {conflict === undefined ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-100" />
            <p className="mt-2 text-sm text-primary-200">Verificando compras pendentes...</p>
          </div>
        ) : conflict.kind === "generic" ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">
                Compra pendente encontrada
              </DialogTitle>
              <DialogDescription className="text-sm text-primary-200">
                Identificamos uma compra em andamento para o telefone {formatPhone(phone)}.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-black/20 p-4 text-sm leading-relaxed text-primary-100">
              <p>
                Para sua segurança, os detalhes e ações desta compra só estão disponíveis
                no navegador onde ela foi iniciada.
              </p>
              <p className="mt-2">
                Acesse o site através do dispositivo e navegador original para concluir o
                pagamento ou cancelar o pedido pendente.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border-primary-300 bg-transparent text-primary-50 hover:bg-white/10"
              >
                Entendi
              </Button>
            </div>
          </div>
        ) : conflict.kind === "authorized" ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">
                {conflict.vouchers.length > 1
                  ? "Compras pendentes encontradas"
                  : "Compra pendente encontrada"}
              </DialogTitle>
              <DialogDescription className="text-sm text-primary-200">
                Você já possui {conflict.vouchers.length > 1 ? "compras" : "uma compra"} para o telefone{" "}
                {formatPhone(phone)}. Escolha uma ação abaixo:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {conflict.vouchers.map((voucher) => (
                <div
                  key={voucher.code}
                  className="space-y-3 rounded-xl bg-black/30 p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold tracking-wide text-primary-200">
                      Código: <span className="font-mono text-base font-bold text-white">{voucher.code}</span>
                    </span>
                    <div>{formatVoucherStatus(voucher.status)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm text-primary-100">
                    <div>
                      <p className="text-xs text-primary-300">Data da visita</p>
                      <p className="font-medium text-white">{formatDate(voucher.visitDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-primary-300">Valor</p>
                      <p className="font-medium text-white">
                        R$ {(voucher.priceCents / 100).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-primary-300">Entradas</p>
                      <p className="font-medium text-white">
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
                    <div className="rounded-lg bg-green-900/30 p-2 text-center text-xs text-green-300">
                      Pagamento aprovado! Este voucher já está válido.
                      <div className="mt-2">
                        <Button
                          asChild
                          size="sm"
                          className="w-full bg-positive-green text-white hover:bg-positive-green/80"
                        >
                          <Link href={`/pagamento?external_reference=${voucher.code}`}>
                            Ver voucher
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ) : voucher.status !== "pending" ? (
                    <div className="rounded-lg bg-white/5 p-2 text-center text-xs text-slate-300">
                      Esta compra está finalizada e não pode mais ser alterada.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                      {voucher.actions.canCancel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCancel?.(voucher.code)}
                          className="rounded-lg border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/20 hover:text-red-200"
                        >
                          Cancelar compra
                        </Button>
                      )}
                      {voucher.actions.canResume && (
                        <Button
                          size="sm"
                          onClick={() => onResume?.(voucher.code)}
                          className="rounded-lg bg-positive-green text-white hover:bg-positive-green/80"
                        >
                          Finalizar pagamento
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-sm text-primary-200 hover:text-white"
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">
                Nenhuma compra pendente
              </DialogTitle>
              <DialogDescription className="text-sm text-primary-200">
                Não há compras pendentes bloqueando este telefone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => onOpenChange(false)}
                className="rounded-xl bg-positive-green text-white hover:bg-positive-green/80"
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
