"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTransition } from "react";
import { Check } from "lucide-react";

import { getErrorMessage } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { api } from "../../../convex/_generated/api";
import { DetailList, describeEntries } from "./_components/admin-ui";
import {
  VoucherSheet,
  WhatsAppLink,
  describeValidity,
  primaryActionClass,
  secondaryActionClass,
} from "./_components/voucher-sheet";

type EmployeeVoucher = FunctionReturnType<typeof api.vouchers.listToday>[number];

function formatVoucherDate(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ms));
}

/** Employee gate drawer: no payment identifiers, just redeem/reactivate. */
export default function EmployeeVoucherInfoCard({
  data,
  onClose,
  open,
}: {
  data: EmployeeVoucher;
  onClose: () => void;
  open: boolean;
}) {
  const [isPending, startTransition] = useTransition();
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
      <DetailList
        rows={[
          { label: "Nome", value: data.name },
          { label: "WhatsApp", value: <WhatsAppLink phone={data.phone} /> },
          { label: "Entradas", value: describeEntries(data) },
          { label: "Validade", value: describeValidity(data.expiresAt) },
          { label: "Gerado em", value: formatVoucherDate(data.createdAt) },
        ]}
      />
    </VoucherSheet>
  );
}
