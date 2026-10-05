"use client";

import { useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Loader2 } from "lucide-react";

import { formateDate, formatReferrer, getErrorMessage } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { api } from "../../../convex/_generated/api";
import { formatCents } from "./dashboard/financeiro/format";
import { AdminVoucherRefundButton } from "./admin-voucher-refund-button";
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

/**
 * The admin gate card: drawer for one voucher by code, backed directly by
 * Convex (`getGateAdminByCode`) so it stays live. Used by the today list and
 * "Validar voucher". Distinct from `VoucherInfoCard`, the
 * all-vouchers table's drawer under /admin/tabela — the two stay separate
 * components rather than sharing a type, since the gate list and the admin
 * table read different Convex queries with different shapes.
 */
export function GateVoucherInfoCard({
  code,
  onClose,
  open,
}: {
  code: string;
  onClose: () => void;
  open: boolean;
}) {
  const data = useQuery(api.vouchers.getGateAdminByCode, { code });

  if (!data) {
    return <VoucherSheetPlaceholder code={code} loading={data === undefined} open={open} onClose={onClose} />;
  }

  return <GateVoucherSheet data={data} open={open} onClose={onClose} />;
}

type AdminGateVoucher = NonNullable<FunctionReturnType<typeof api.vouchers.getGateAdminByCode>>;

function GateVoucherSheet({
  data,
  onClose,
  open,
}: {
  data: AdminGateVoucher;
  onClose: () => void;
  open: boolean;
}) {
  const redeemByCode = useMutation(api.vouchers.redeemByCode);
  const reactivate = useMutation(api.vouchers.reactivate);
  const [isPending, startTransition] = useTransition();
  const reconcileState = useGateReconcile(data.code);

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
      {data.paymentIssue ? (
        <div role="alert" className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          <p className="font-medium">{paymentIssueLabel(data.paymentIssue.kind)}</p>
          <p className="mt-1 break-words">
            Status: {data.paymentIssue.status}
            {data.paymentIssue.statusDetail ? ` (${data.paymentIssue.statusDetail})` : ""}
            {" · "}
            {formateDate(new Date(data.paymentIssue.notedAt).toISOString())}
            {data.paymentIssue.refundedCents !== undefined
              ? ` · Reembolsado: ${formatCents(data.paymentIssue.refundedCents)}`
              : ""}
          </p>
        </div>
      ) : null}
      {data.reversal ? (
        <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
          Atenção: pagamento estornado ({formateDate(new Date(data.reversal.notedAt).toISOString())}).
        </p>
      ) : null}
      <DetailList
        rows={[
          { label: "Nome", value: data.name, copy: data.name },
          { label: "WhatsApp", value: <WhatsAppLink phone={data.phone} />, copy: data.phone },
          { label: "Entradas", value: describeEntries(data) },
          { label: "Validade", value: describeValidity(data.expiresAt) },
          { label: "Gerado em", value: formateDate(new Date(data.createdAt).toISOString()) },
          { label: "Origem", value: data.referrer ? formatReferrer(data.referrer.source) : "—" },
          { label: "Pagamento", value: data.paymentId ?? "Nenhum pagamento", copy: data.paymentId ?? null },
          { label: "Preferência", value: data.preferenceId, copy: data.preferenceId },
        ]}
      />
      <AdminVoucherRefundButton code={data.code} paymentId={data.paymentId} status={data.status} />
      {canShowVoucherImage(data.status) ? (
        <VoucherImage code={data.code} phone={data.phone} version={`${data.status}-${data.expiresAt}`} />
      ) : null}
    </VoucherSheet>
  );
}
