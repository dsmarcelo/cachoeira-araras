"use client";
import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSavedVouchers } from "../../_components/saved-vouchers-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/utils";
import { setCachedLookupToken } from "@/lib/voucher/lookup-token-cache";
import {
  sanitizeVoucherCode,
  VOUCHER_CODE_MAX_LENGTH,
  VOUCHER_CODE_MIN_LENGTH,
} from "@/lib/voucher/verify-code";

/**
 * "Verificar voucher" flow: the customer types a Voucher Code and the phone
 * used at purchase; only when both match is the voucher saved into this
 * browser's list (ADR 0007). The server answers every mismatch the same way.
 */
export function VerifyVoucherDialog() {
  const convex = useConvex();
  const { vouchers, save } = useSavedVouchers();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setPhone("");
      setCode("");
      setError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const phoneDigits = phone.replace(/\D/g, "");
    // Same rule as the checkout form: DDD plus a mobile number starting with 9.
    if (phoneDigits.length !== 11 || phoneDigits.charAt(2) !== "9") {
      setError(
        "Número incorreto, não se esqueça de colocar o DDD e o 9 no início",
      );
      return;
    }
    if (vouchers.some((entry) => entry.code === code)) {
      setError("Este voucher já está na sua lista");
      return;
    }
    try {
      setIsChecking(true);
      setError(null);
      const result = await convex.mutation(api.vouchers.authorizeLookupByPhone, {
        code,
        phone: phoneDigits,
      });
      if (result.kind === "not_found") {
        setError("Código ou telefone não conferem.");
      } else if (result.kind === "rate_limited") {
        setError(
          "Muitas tentativas de consulta. Aguarde um instante e tente novamente.",
        );
      } else {
        setCachedLookupToken(code, result.lookupToken);
        const saved = save({
          code,
          initPoint: "",
          createdAt: result.voucher.createdAt,
        });
        if (saved) setOpen(false);
        else
          setError(
            "Não foi possível salvar o voucher neste navegador. Verifique o armazenamento do navegador e tente novamente.",
          );
      }
    } catch {
      setError(
        "Não foi possível verificar o voucher agora. Tente novamente em instantes.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="inverseOutline">Verificar voucher</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Verificar voucher</DialogTitle>
          <DialogDescription>
            Informe o telefone usado na compra e o código do voucher para
            adicioná-lo a este navegador.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid gap-2">
            <Label htmlFor="verify-phone">Telefone</Label>
            <Input
              id="verify-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(XX) 99999-9999"
              maxLength={15}
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="verify-code">Código do voucher</Label>
            <Input
              id="verify-code"
              autoComplete="off"
              autoCapitalize="none"
              maxLength={VOUCHER_CODE_MAX_LENGTH}
              value={code}
              onChange={(e) => setCode(sanitizeVoucherCode(e.target.value))}
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <DialogFooter>
            <Button
              type="submit"
              disabled={isChecking || code.length < VOUCHER_CODE_MIN_LENGTH}
            >
              {isChecking ? "Verificando..." : "Verificar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
