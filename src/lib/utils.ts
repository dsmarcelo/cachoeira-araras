import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { VoucherSchema } from "./voucher/types";

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

export function formatPhone(input: string): string {
  let cleanNumber = input.replace(/\D/g, "").substring(0, 11);

  cleanNumber = cleanNumber.replace(/\D/g, "");
  cleanNumber = cleanNumber.replace(/^(\d{2})(\d)/g, "($1) $2");
  cleanNumber = cleanNumber.replace(/(\d)(\d{4})$/, "$1-$2");

  return cleanNumber;
}

export function formatWhatsAppMessage(voucher: VoucherSchema): string {
  const phoneNumber = "556299251040";
  const message = `Ola, meu nome é ${voucher.name} e comprei um voucher para ${voucher.adults} pessoas com mais de 8 anos e ${voucher.elderly} pessoas com mais de 60 anos ou especiais.

 Código: ${voucher.code}`;
  const urlEncodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${urlEncodedMessage}`;
}

// const now = new Date();
// const formattedDate = formatDate(now);
//   const dateTime = date.toLocaleString("pt-BR", {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
//   const formatedString = dateString.replaceAll("/", "-");
//   return formattedDate;
// }
