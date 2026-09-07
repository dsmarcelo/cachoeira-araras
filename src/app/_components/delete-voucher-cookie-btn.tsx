"use client";
import { Button } from "@/components/ui/button";
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
import { useSavedVouchers } from "./saved-vouchers-provider";

export default function DeleteVoucherCookieBtn({ code }: { code: string }) {
  const { remove } = useSavedVouchers();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost">Remover deste navegador</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remover o voucher {code} deste navegador?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Isso não cancela o voucher nem o pagamento. Anote o código antes de
            remover. Seus outros vouchers continuarão salvos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={() => void remove(code)}>
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
