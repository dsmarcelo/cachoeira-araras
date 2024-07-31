import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type VoucherSchema } from "./voucher/types";
import React from "react";

const url = process.env.URL;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formateDate(input: string) {
  const date = new Date(input);
  const day = String(date.getDate()).padStart(2, "0"); // Adiciona zero à esquerda se necessário
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Meses são baseados em zero, então adicionamos 1
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} às ${hours}:${minutes}h`;
}

export function formateDateDayMonthYear(input: string | Date) {
  let date = new Date();
  typeof input === "string"
    ? (date = new Date(input.toString()))
    : (date = new Date(input));
  const day = String(date.getDate()).padStart(2, "0"); // Adiciona zero à esquerda se necessário
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Meses são baseados em zero, então adicionamos 1
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function formatPhone(input: string): string {
  let cleanNumber = input.replace(/\D/g, "").substring(0, 11);

  cleanNumber = cleanNumber.replace(/\D/g, "");
  cleanNumber = cleanNumber.replace(/^(\d{2})(\d)/g, "($1) $2");
  cleanNumber = cleanNumber.replace(/(\d)(\d{4})$/, "$1-$2");

  return cleanNumber;
}

export function formatWhatsAppMessage(voucher: VoucherSchema): string {
  const phoneNumber = "556299251040";
  const message = `Ola, meu nome é ${voucher.name} e comprei um voucher para ${voucher.adults} pessoa(s) com mais de 8 anos e ${voucher.elderly} pessoa(s) com mais de 60 anos ou especiais.

 Código: ${voucher.code}`;
  const urlEncodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${urlEncodedMessage}`;
}

export function formatPaymentUrl(
  preference_id: string,
  payment_id: string,
): string {
  return `/pagamento?collection_id=${payment_id}&collection_status=approved&payment_id=${payment_id}&status=approved&preference_id=${preference_id}&site_id=MLB&processing_mode=aggregator&merchant_account_id=null`;
}

export function formatToBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function truncateName(name: string): string {
  const maxLength = 35;
  if (name.length > maxLength) {
    return name.slice(0, maxLength - 3) + "...";
  }
  return name;
}

export function useWindowWidth(): number {
  const [windowWidth, setWindowWidth] = React.useState<number>(
    window.innerWidth,
  );

  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return windowWidth;
}
