"use client";

import * as React from "react";
import { useAction, useQuery } from "convex/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

interface AdminVoucherRefundButtonProps {
  code: string;
  paymentId?: string;
  status: string;
}

const refundMessages = {
  pending_attempt: "Reembolso solicitado. Aguardando processamento.",
  processing: "Reembolso em processamento.",
  completed: "Reembolso integral confirmado pelo Mercado Pago.",
  needs_retry:
    "Reembolso pendente. Uma nova tentativa será feita automaticamente.",
  needs_attention:
    "Reembolso pendente. A equipe precisa verificar o pagamento.",
} as const;

/** Admin control for refunding the voucher's official Mercado Pago payment. */
export function AdminVoucherRefundButton({
  code,
  paymentId,
  status,
}: AdminVoucherRefundButtonProps) {
  const requestRefund = useAction(api.refunds.requestAdminRefund);
  const refund = useQuery(
    api.refunds.getAdminVoucherRefund,
    paymentId ? { paymentId } : "skip",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (!paymentId) return null;

  if (refund) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {refundMessages[refund.status]}
      </p>
    );
  }

  if (!["valid", "redeemed", "expired"].includes(status)) return null;

  async function handleRefund() {
    setIsSubmitting(true);
    try {
      await requestRefund({ code });
      setDialogOpen(false);
      toast({
        title: "Reembolso solicitado",
        description: "Acompanhe o andamento neste voucher.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível solicitar o reembolso",
        description: getErrorMessage(error, "Tente novamente mais tarde."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={isSubmitting || refund === undefined}
        >
          Reembolsar pagamento
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Reembolsar o pagamento do voucher {code}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            O reembolso integral será solicitado ao Mercado Pago para o
            pagamento {paymentId}. Se ainda estiver disponível, o voucher
            perderá a validade após a confirmação. Caso já tenha sido resgatado,
            o estorno ficará registrado. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting}
            onClick={(event) => {
              event.preventDefault();
              void handleRefund();
            }}
          >
            {isSubmitting ? "Solicitando..." : "Confirmar reembolso"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
