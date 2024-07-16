import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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

// const now = new Date();
// const formattedDate = formatDate(now);
//   const dateTime = date.toLocaleString("pt-BR", {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
//   const formatedString = dateString.replaceAll("/", "-");
//   return formattedDate;
// }
