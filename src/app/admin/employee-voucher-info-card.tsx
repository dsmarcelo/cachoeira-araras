"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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
import { formatQuantity, formatVoucherStatus } from "@/lib/voucher";
import { formatPhone } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { api } from "../../../convex/_generated/api";

type EmployeeVoucher = FunctionReturnType<typeof api.vouchers.listToday>[number];

function formatVoucherDate(ms: number) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(ms));
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
  const redeemByCode = useMutation(api.vouchers.redeemByCode);
  const reactivate = useMutation(api.vouchers.reactivate);

  function handleRedeemVoucher() {
    startTransition(async () => {
      try {
        await redeemByCode({ code: data.code });
        toast({ title: "Voucher resgatado com sucesso" });
        onClose();
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : "Erro ao usar voucher",
          variant: "destructive",
        });
      }
    });
  }

  function handleActivateVoucher() {
    startTransition(async () => {
      try {
        await reactivate({ code: data.code });
        toast({ title: "Voucher ativado com sucesso" });
        onClose();
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : "Erro ao ativar voucher",
          variant: "destructive",
        });
      }
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
                adults_pool: data.adultsPool,
                elderly_pool: data.elderlyPool,
              })}
            </p>
            <div>{formatVoucherStatus(data.status)}</div>
            <p>{`Criado em: ${formatVoucherDate(data.createdAt)}`}</p>
            <p>{`Válido para: ${formatVoucherDate(data.expiresAt)}`}</p>
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
