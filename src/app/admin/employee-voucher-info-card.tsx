"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { getErrorMessage } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { api } from "../../../convex/_generated/api";
import { DetailList, describeEntries } from "./_components/admin-ui";
import { gateReconcileFailedMessage, paymentIssueLabel, useGateReconcile } from "./_components/use-gate-reconcile";
import { VoucherImage, canShowVoucherImage } from "./_components/voucher-image";
import {
  VoucherSheet,
  VoucherSheetPlaceholder,
  WhatsAppLink,
  describeValidity,
  primaryActionClass,
  secondaryActionClass,
} from "./_components/voucher-sheet";

function formatVoucherDate(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ms));
}

type EmployeeVoucher = NonNullable<FunctionReturnType<typeof api.vouchers.getGateByCode>>;

/**
 * Employee gate drawer for one voucher by code: no payment identifiers, just
 * redeem/reactivate and the image.
 */
export default function EmployeeVoucherInfoCard({
  code,
  onClose,
  open,
}: {
  code: string;
  onClose: () => void;
  open: boolean;
}) {
  const data = useQuery(api.vouchers.getGateByCode, { code });

  if (!data) {
    return <VoucherSheetPlaceholder code={code} loading={data === undefined} open={open} onClose={onClose} />;
  }

  return <EmployeeVoucherSheet data={data} open={open} onClose={onClose} />;
}

function EmployeeVoucherSheet({
  data,
  onClose,
  open,
}: {
  data: EmployeeVoucher;
  onClose: () => void;
  open: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const reconcileState = useGateReconcile(data.code);
  const redeemByCode = useMutation(api.vouchers.redeemByCode);
  const reactivate = useMutation(api.vouchers.reactivate);

  function run(action: () => Promise<unknown>, success: string, failure: string) {
    startTransition(async () => {
      try {
        await action();
        toast({ title: success });
        onClose();
      } catch (error) {
        toast({ title: getErrorMessage(error, failure), variant: "destructive" });
      }
    });
  }

  return (
    <VoucherSheet
      code={data.code}
      status={data.status}
      open={open}
      onClose={onClose}
      actions={
        <>
          <button
            type="button"
            className={primaryActionClass}
            disabled={isPending || reconcileState === "checking" || data.status !== "valid"}
            onClick={() => run(() => redeemByCode({ code: data.code }), "Voucher resgatado com sucesso", "Erro ao usar voucher")}
          >
            {reconcileState === "checking" ? (
              <Loader2 className="size-[18px] animate-spin" aria-hidden />
            ) : (
              <Check className="size-[18px]" aria-hidden />
            )}
            Usar voucher
          </button>
          {/* Valid vouchers have nothing to reactivate; refunded ones cannot be revived. */}
          {data.status !== "valid" && data.status !== "refunded" ? (
            <button
              type="button"
              className={secondaryActionClass}
              disabled={isPending}
              onClick={() => run(() => reactivate({ code: data.code }), "Voucher ativado com sucesso", "Erro ao ativar voucher")}
            >
              Reativar voucher
            </button>
          ) : null}
        </>
      }
    >
      {reconcileState === "failed" ? (
        <p role="status" className="rounded-[10px] border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm text-zinc-700">
          {gateReconcileFailedMessage}
        </p>
      ) : null}
      {data.paymentIssueKind ? (
        <p role="alert" className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm font-medium text-amber-900">
          {paymentIssueLabel(data.paymentIssueKind)}
        </p>
      ) : null}
      <DetailList
        rows={[
          { label: "Nome", value: data.name },
          { label: "WhatsApp", value: <WhatsAppLink phone={data.phone} /> },
          { label: "Entradas", value: describeEntries(data) },
          { label: "Validade", value: describeValidity(data.expiresAt) },
          { label: "Gerado em", value: formatVoucherDate(data.createdAt) },
        ]}
      />
      {canShowVoucherImage(data.status) ? (
        <VoucherImage code={data.code} phone={data.phone} version={`${data.status}-${data.expiresAt}`} />
      ) : null}
    </VoucherSheet>
  );
}
