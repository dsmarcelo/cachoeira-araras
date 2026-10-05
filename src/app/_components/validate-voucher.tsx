"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Check, CircleX } from "lucide-react";

import {
  Panel,
  VoucherStatusBadge,
  describeEntries,
  type VoucherStatus,
} from "@/app/admin/_components/admin-ui";
import EmployeeVoucherInfoCard from "@/app/admin/employee-voucher-info-card";
import { GateVoucherInfoCard } from "@/app/admin/gate-voucher-info-card";
import { secondaryActionClass } from "@/app/admin/_components/voucher-sheet";
import { cn, getErrorMessage } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

const statusHints: Record<VoucherStatus, string> = {
  valid: "Pago e dentro da validade. Confirme a entrada abaixo.",
  pending: "Pagamento ainda não confirmado pelo Mercado Pago. Não libere a entrada.",
  redeemed: "Este voucher já foi usado. Não libere uma nova entrada.",
  expired: "A data deste voucher já passou.",
  refunded: "O pagamento foi devolvido. Não libere a entrada.",
  cancelled: "Este voucher foi cancelado. Não libere a entrada.",
};

const resultSurface: Partial<Record<VoucherStatus, string>> = {
  valid: "border-green-200 bg-green-50",
  pending: "border-amber-200 bg-amber-50",
};

/**
 * Gate staff type a Voucher Code, see its live status, and redeem it. Backed
 * directly by Convex: `getByCodeForStaff` is a reactive query (so a payment
 * the Mercado Pago webhook just confirmed shows up without refetching),
 * gated on the caller's staff role rather than the anonymous rate limiter
 * applied to public lookups. `redeemByCode` is staff-gated server-side too,
 * so a public caller can neither read nor redeem anything even if this
 * component were reachable by one. "Mostrar Informações" opens the role's
 * gate drawer (admins see payment details, employees do not) for the result.
 */
export default function ValidateVoucher({ role }: { role: "admin" | "employee" }) {
  const [voucherCode, setVoucherCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const voucher = useQuery(
    api.vouchers.getByCodeForStaff,
    lookupCode ? { code: lookupCode } : "skip",
  );
  const redeemByCode = useMutation(api.vouchers.redeemByCode);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setLookupCode("");
    setMessage(null);
    setVoucherCode(e.target.value.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 16));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!voucherCode) return;
    setLookupCode(voucherCode);
    setMessage(null);
  }

  async function handleRedeem() {
    if (!lookupCode) return;
    setIsRedeeming(true);
    try {
      await redeemByCode({ code: lookupCode });
      setMessage({ ok: true, text: "Voucher usado com sucesso" });
    } catch (error) {
      setMessage({ ok: false, text: getErrorMessage(error, "Erro ao usar voucher") });
    } finally {
      setIsRedeeming(false);
    }
  }

  const isLoading = lookupCode !== "" && voucher === undefined;
  const notFound = lookupCode !== "" && voucher === null;

  return (
    <Panel className="p-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label htmlFor="code" className="flex flex-col gap-2 text-sm font-medium">
        Código do voucher
        <input
          id="code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={voucherCode}
          onChange={handleChange}
          placeholder="ex.: ARA7K3Q"
          className="h-[60px] w-full rounded-[10px] border border-border bg-white px-4 text-center font-mono text-[26px] font-semibold uppercase tracking-[0.12em] shadow-sm outline-none placeholder:text-base placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={!voucherCode || isLoading}
        className="h-[52px] rounded-[10px] bg-zinc-900 text-base font-semibold text-zinc-50 transition-opacity hover:bg-zinc-800 disabled:opacity-50"
      >
        {isLoading ? "Validando..." : "Validar"}
      </button>

      {notFound ? (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700"
        >
          <CircleX className="size-[18px] shrink-0" aria-hidden />
          Voucher não encontrado. Confira o código.
        </div>
      ) : null}

      {voucher ? (
        <div
          className={cn(
            "flex flex-col gap-3.5 rounded-[10px] border p-4",
            resultSurface[voucher.status] ?? "border-border bg-zinc-50",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                {voucher.code}
              </span>
              <span className="text-[17px] font-semibold">{describeEntries(voucher)}</span>
            </div>
            <VoucherStatusBadge status={voucher.status} className="px-2.5 py-1 text-xs font-semibold" />
          </div>
          <p className="text-[13px] text-zinc-600">{statusHints[voucher.status]}</p>

          {voucher.status === "valid" ? (
            <button
              type="button"
              onClick={() => void handleRedeem()}
              disabled={isRedeeming}
              className="flex h-[52px] items-center justify-center gap-2 rounded-[10px] bg-teal-700 text-base font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60"
            >
              <Check className="size-[18px]" aria-hidden />
              {isRedeeming ? "Registrando..." : "Usar voucher"}
            </button>
          ) : null}

          {message ? (
            <div
              role={message.ok ? "status" : "alert"}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-[10px] border bg-white text-sm font-semibold",
                message.ok ? "border-green-200 text-green-700" : "border-red-200 text-red-700",
              )}
            >
              {message.ok ? <Check className="size-[18px]" aria-hidden /> : null}
              {message.text}
            </div>
          ) : null}
        </div>
      ) : null}

      {voucher ? (
        <button
          type="button"
          className={secondaryActionClass}
          onClick={() => setShowInfo(true)}
        >
          Mostrar Informações
        </button>
      ) : null}
      </form>
      {voucher && showInfo ? (
        role === "admin" ? (
          <GateVoucherInfoCard code={voucher.code} open onClose={() => setShowInfo(false)} />
        ) : (
          <EmployeeVoucherInfoCard code={voucher.code} open onClose={() => setShowInfo(false)} />
        )
      ) : null}
    </Panel>
  );
}
