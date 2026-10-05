"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useConvex } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useSavedVouchers } from "../../../_components/saved-vouchers-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/utils";
import { setCachedLookupToken } from "@/lib/voucher/lookup-token-cache";
import {
  sanitizeVoucherCode,
  VOUCHER_CODE_MIN_LENGTH,
} from "@/lib/voucher/verify-code";

/**
 * "Procurar voucher" page: the customer types a Voucher Code and the phone
 * used at purchase; only when both match is the voucher saved into this
 * browser's list (ADR 0007). The server answers every mismatch the same way.
 * A full page rather than a dialog keeps the inputs above mobile keyboards.
 */
export default function FindVoucherPage() {
  const convex = useConvex();
  const router = useRouter();
  const { vouchers, save } = useSavedVouchers();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (saved) router.replace("/meus-vouchers");
        else
          setError(
            "Não foi possível salvar o voucher neste navegador. Verifique o armazenamento do navegador e tente novamente.",
          );
      }
    } catch {
      setError(
        "Não foi possível procurar o voucher agora. Tente novamente em instantes.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <main className="bg-page px-4 py-8 text-fg-muted">
      <div className="mx-auto flex max-w-sm flex-col gap-6">
        <Button
          asChild
          variant="inverseGhost"
          className="-ml-3 w-fit gap-2 text-base"
        >
          <Link href="/meus-vouchers">
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Voltar
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Procurar voucher</h1>
        <p>
          Informe o telefone usado na compra e o código do voucher para
          adicioná-lo a este navegador.
        </p>
        <form
          className="grid gap-4 rounded-xl bg-surface p-6"
          onSubmit={(e) => void handleSubmit(e)}
        >
          <div className="grid gap-2">
            <Label htmlFor="find-phone">Telefone</Label>
            <Input
              className="rounded-xl text-field-fg"
              id="find-phone"
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
            <Label htmlFor="find-code">Código do voucher</Label>
            <Input
              className="rounded-xl text-field-fg"
              id="find-code"
              autoComplete="off"
              autoCapitalize="none"
              value={code}
              onChange={(e) => setCode(sanitizeVoucherCode(e.target.value))}
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <Button
            type="submit"
            variant="brand"
            disabled={isChecking || code.length < VOUCHER_CODE_MIN_LENGTH}
          >
            {isChecking ? "Procurando..." : "Procurar"}
          </Button>
        </form>
      </div>
    </main>
  );
}
