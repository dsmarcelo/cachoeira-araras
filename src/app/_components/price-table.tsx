"use client";

import React from "react";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";

interface PriceSummaryProps {
  label: string;
  priceCents: number;
  description?: string;
}

function formatCentsAsReais(priceCents: number) {
  return (priceCents / 100).toFixed(2).replace(".", ",");
}

function PriceSummary({ label, priceCents, description }: PriceSummaryProps) {
  // We keep this tiny helper isolated to avoid repeating formatting logic across the table.
  return (
    <div className="flex w-full justify-between">
      <div className="flex flex-col gap-1">
        <p>{label}</p>
        {description ? (
          <p className="text-sm text-fg-muted/80">{description}</p>
        ) : null}
      </div>
      <p>R${formatCentsAsReais(priceCents)}</p>
    </div>
  );
}

export default function PriceTable() {
  // The public settings query includes prices from the Convex environment.
  const settings = useQuery(api.settings.getAll);

  if (!settings) {
    return (
      <div className="flex w-full flex-col items-center justify-center">
        <h3 className="h-12 py-2 text-xl font-bold text-fg-muted">
          Adquira já seu voucher
        </h3>
        <div className="flex w-full items-center justify-center bg-surface-alt pb-2 pt-6 font-semibold text-fg">
          <p className="text-fg-muted">Carregando preços...</p>
        </div>
      </div>
    );
  }

  const voucherPriceCents = settings["voucher.price"];
  const enableVoucherBuy = settings["enable.voucher.buy"];

  const elderlyPriceCents = voucherPriceCents / 2;

  const showRegular = enableVoucherBuy && voucherPriceCents > 0;

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <h3 className="h-12 py-2 text-xl font-bold text-fg-muted">
        Adquira já seu voucher
      </h3>
      <div className="flex w-full flex-col gap-2 bg-surface-alt pb-2 pt-1 font-semibold text-fg">
        <div className="flex w-full flex-col gap-2 px-4">
          {showRegular && (
            <PriceSummary label="Voucher" priceCents={voucherPriceCents} />
          )}

          <PriceSummary
            label="Meia (+60 e especiais)"
            priceCents={elderlyPriceCents}
            description="Compra apenas na portaria, necessário apresentar documento."
          />

          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              <p>Crianças até 8 anos</p>
            </div>
            Grátis
          </div>
        </div>
      </div>
    </div>
  );
}
