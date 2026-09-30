"use client";

import { useTransition } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check } from "lucide-react";

import { formateDate, formatReferrer, getErrorMessage } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { api } from "../../../convex/_generated/api";
import { AdminVoucherRefundButton } from "./admin-voucher-refund-button";
import { DetailList, describeEntries } from "./_components/admin-ui";
import {
  VoucherSheet,
  WhatsAppLink,
  describeValidity,
  primaryActionClass,
  secondaryActionClass,
} from "./_components/voucher-sheet";

type AdminGateVoucher = FunctionReturnType<typeof api.vouchers.listTodayAdmin>[number];

/**
 * The admin gate card: today's-voucher list drawer, backed directly by
 * Convex (`listTodayAdmin`). Distinct from `VoucherInfoCard`, the
 * all-vouchers table's drawer under /admin/tabela — the two stay separate
 * components rather than sharing a type, since the gate list and the admin
 * table read different Convex queries with different shapes.
 */
export function GateVoucherInfoCard({
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
            disabled={isPending || data.status !== "valid"}
            onClick={() => run(() => redeemByCode({ code: data.code }), "Voucher resgatado com sucesso", "Erro ao usar voucher")}
          >
            <Check className="size-[18px]" aria-hidden />
            Usar voucher
          </button>
          <button
            type="button"
            className={secondaryActionClass}
            disabled={isPending}
            onClick={() => run(() => reactivate({ code: data.code }), "Voucher ativado com sucesso", "Erro ao ativar voucher")}
          >
            Reativar voucher
          </button>
        </>
      }
    >
      {data.reversal ? (
        <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
          Atenção: pagamento estornado após o resgate ({formateDate(new Date(data.reversal.notedAt).toISOString())}).
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
          { label: "Preferência", value: data.preferenceId ?? "Sem preferência (pagamento no site)", copy: data.preferenceId ?? null },
        ]}
      />
      <AdminVoucherRefundButton code={data.code} paymentId={data.paymentId} status={data.status} />
    </VoucherSheet>
  );
}
