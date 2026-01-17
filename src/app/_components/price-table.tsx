"use client";

import React from "react";
import { api } from "@/trpc/react";

interface PriceSummaryProps {
  label: string;
  price: number;
  description?: string;
}

function PriceSummary({ label, price, description }: PriceSummaryProps) {
  // We keep this tiny helper isolated to avoid repeating formatting logic across the table.
  return (
    <div className="flex w-full justify-between">
      <div className="flex flex-col gap-1">
        <p>{label}</p>
        {description ? (
          <p className="text-sm text-primary-100/80">{description}</p>
        ) : null}
      </div>
      <p>R${price.toFixed(2).replace(".", ",")}</p>
    </div>
  );
}

export default function PriceTable() {
  // Fetch all settings once. We keep sensible fallbacks to avoid flashing empty content.
  const settingsQuery = api.settings.getAll.useQuery();
  const data = settingsQuery.data;

  if (!data) {
    return (
      <div className="flex w-full flex-col items-center justify-center">
        <h3 className="h-12 py-2 text-xl font-bold text-primary-100">
          Adquira já seu voucher
        </h3>
        <div className="flex w-full items-center justify-center bg-custom-secondary pb-2 pt-6 font-semibold text-primary-50">
          <p className="text-primary-100">Carregando preços...</p>
        </div>
      </div>
    );
  }

  const voucherPrice = data["voucher.price"] ?? 0;
  const poolVoucherPrice = data["voucher.pool.price"] ?? 0;
  const enableVoucherBuy = data["enable.voucher.buy"] ?? true;
  const enablePoolVoucherBuy = data["enable.voucher.pool.buy"] ?? true;
  const enableHalfPriceVoucherBuy =
    data["enable.voucher.half-price.buy"] ?? true;
  const enableHalfPricePoolVoucherBuy =
    data["enable.voucher.half-price.pool.buy"] ?? true;

  const elderlyPrice = voucherPrice / 2;
  const poolElderlyPrice = poolVoucherPrice / 2;

  const showRegular = enableVoucherBuy && voucherPrice > 0;
  const showRegularHalf = showRegular && enableHalfPriceVoucherBuy;
  const showPool = enablePoolVoucherBuy && poolVoucherPrice > 0;
  const showPoolHalf = showPool && enableHalfPricePoolVoucherBuy;

  // Track whether at least one price is visible; useful to display fallback messaging.
  const hasAnyPrice =
    showRegular || showRegularHalf || showPool || showPoolHalf;

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <h3 className="h-12 py-2 text-xl font-bold text-primary-100">
        Adquira já seu voucher
      </h3>
      <div className="flex w-full flex-col gap-2 bg-custom-secondary pb-2 pt-1 font-semibold text-primary-50">
        <div className="flex h-10 w-full items-center justify-center bg-dark-blue">
          <p className="text-lg font-semibold text-primary-50">
            Day use (Cachoeira + Bar Pé de Serra)
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 px-4">
          {showRegular && (
            <PriceSummary
              label="Inteira (de 9 a 59 anos)"
              price={voucherPrice}
            />
          )}

          <PriceSummary
            label="Meia (+60 e especiais)"
            price={elderlyPrice}
            description="Compra apenas na portaria, necessário apresentar documento."
          />

          {/* {showRegularHalf && (
            <PriceSummary label="Meia (+60 e especiais)" price={elderlyPrice} />
          )} */}

          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              <p>Crianças até 8 anos</p>
            </div>
            Grátis
          </div>
        </div>
        {(showPool ?? showPoolHalf) ? (
          <>
            <div className="flex h-10 w-full items-center justify-center bg-dark-blue">
              <p className="text-lg font-semibold text-primary-50">
                Day Use + Acesso a piscina
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 px-4">
              {showPool && (
                <PriceSummary
                  label="Acesso a piscina"
                  price={poolVoucherPrice}
                />
              )}

              /*<PriceSummary
                label="Meia (+60 e especiais)"
                price={poolElderlyPrice}
                description="Compra apenas na portaria, necessário apresentar documento."
              />*/

              <div className="flex w-full justify-between">
                <div className="flex gap-2">
                  <p>Crianças até 8 anos</p>
                </div>
                Grátis
              </div>
            </div>
          </>
        ) : null}
        {!hasAnyPrice ? <></> : null}
      </div>
    </div>
  );
}
