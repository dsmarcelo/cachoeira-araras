"use client";

import { useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
} from "@/components/ui/drawer";
import { redeemVoucher, activateVoucher } from "@/app/lib";
import { formatQuantity, formatVoucherStatus } from "@/lib/voucher";
import { formatPhone } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import type { RouterOutputs } from "@/trpc/react";

type EmployeeVoucher =
  RouterOutputs["voucher"]["getTodayOperationalVouchers"][number];

function formatVoucherDate(date: Date | null | undefined) {
  if (!date) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
}

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

  function handleRedeemVoucher() {
    startTransition(async () => {
      await redeemVoucher(data.code);
      toast({
        title: "Voucher resgatado com sucesso",
      });
      window.location.reload();
    });
  }

  function handleActivateVoucher() {
    startTransition(async () => {
      await activateVoucher(data.code);
      toast({
        title: "Voucher ativado com sucesso",
      });
      window.location.reload();
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      preventScrollRestoration={true}
      shouldScaleBackground={true}
    >
      <DrawerContent>
        <DrawerHeader className="max-h-[80dvh] overflow-y-auto text-left">
          <DrawerTitle>{`Voucher ${data.code}`}</DrawerTitle>
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-lg font-semibold">{data.name}</p>
            <Link href={`https://wa.me/${data.phone}`} target="_blank">
              {formatPhone(data.phone)}
            </Link>
            <p>
              {formatQuantity({
                adults: data.adults,
                elderly: data.elderly,
                adults_pool: data.adults_pool,
                elderly_pool: data.elderly_pool,
              })}
            </p>
            <div>{formatVoucherStatus(data.status)}</div>
            <p>{`Criado em: ${formatVoucherDate(data.createdAt)}`}</p>
            <p>{`Válido para: ${formatVoucherDate(data.expires_at)}`}</p>
          </div>
        </DrawerHeader>
        <DrawerFooter className="grid grid-cols-3 gap-2 pt-2">
          <DrawerClose asChild>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DrawerClose>
          <Button
            variant="outline"
            onClick={handleRedeemVoucher}
            disabled={isPending}
          >
            {isPending ? "Salvando..." : "Usar voucher"}
          </Button>
          <Button
            variant="outline"
            onClick={handleActivateVoucher}
            disabled={isPending}
          >
            {isPending ? "Salvando..." : "Ativar voucher"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
      <DrawerOverlay onClick={onClose} />
    </Drawer>
  );
}
