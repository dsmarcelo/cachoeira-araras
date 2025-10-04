import React from "react";
import {
  getVoucherPrice,
  getElderlyVoucherPrice,
  getPoolVoucherPrice,
  getPoolElderlyVoucherPrice,
} from "@/lib/utils/utils";

export default function PriceTable() {
  const voucherPrice = getVoucherPrice();
  const elderlyPrice = getElderlyVoucherPrice();
  const poolVoucherPrice = getPoolVoucherPrice();
  const poolElderlyPrice = getPoolElderlyVoucherPrice();

  return (
    <div className="flex w-full flex-col items-center justify-center">
      <h3 className="h-12 py-2 text-xl font-bold text-primary-100">
        Adquira já seu voucher
      </h3>
      <div className="bg-custom-secondary flex w-full flex-col gap-2 pb-2 pt-1 font-semibold text-primary-50">
        <div className="flex h-10 w-full items-center justify-center bg-dark-blue">
          <p className="text-lg font-semibold text-primary-50">
            Day use (Cachoeira + Bar Pé de Serra)
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 px-4">
          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              <p>Inteira (de 9 a 59 anos)</p>
            </div>
            R${voucherPrice.toFixed(2).replace(".", ",")}
          </div>
          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              <p>Meia (+60 e especiais)</p>
            </div>
            R${elderlyPrice.toFixed(2).replace(".", ",")}
          </div>
          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              <p>Crianças até 8 anos</p>
            </div>
            Grátis
          </div>
        </div>
        <div className="flex h-10 w-full items-center justify-center bg-dark-blue">
          <p className="text-lg font-semibold text-primary-50">
            Day Use + Acesso a piscina
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 px-4">
          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              <p>Inteira (de 9 a 59 anos)</p>
            </div>
            R${poolVoucherPrice.toFixed(2).replace(".", ",")}
          </div>
          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              <p>Meia (+60 e especiais)</p>
            </div>
            R${poolElderlyPrice.toFixed(2).replace(".", ",")}
          </div>
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
