/**
 * A Voucher Code must be short enough to read aloud at a gate. Four
 * lowercase alphanumeric characters, drawn with the Web Crypto API
 * (`crypto.getRandomValues`, available in Convex's default V8 action
 * runtime — no `"use node"` needed and no `node:crypto` import).
 */
const codeAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateVoucherCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);

  let code = "";
  for (const byte of bytes) {
    code += codeAlphabet[byte % codeAlphabet.length];
  }

  return code;
}

export function splitCustomerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    surname: parts.slice(1).join(" "),
  };
}

export function classifyReferrer(referrerUrl: string): string {
  switch (true) {
    case referrerUrl.includes("fbclid"):
      return "Facebook";
    case referrerUrl.includes("gclid"):
      return "Google";
    case referrerUrl.includes("igshid"):
      return "Instagram";
    case referrerUrl.includes("mail.google"):
      return "Gmail";
    default:
      return "";
  }
}

export function formatVoucherCheckoutDescription({
  adults,
  elderly,
  adultsPool,
  elderlyPool,
  phone,
  code,
}: {
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
  phone: string;
  code: string;
}): string {
  let description = `Voucher com código ${code}`;

  if (adults > 0 && elderly > 0) {
    description += `, ${adults} entrada(s) inteiras e ${elderly} entrada(s) meias`;
  } else if (adults > 0) {
    description += `, ${adults} entrada(s) inteiras`;
  } else if (elderly > 0) {
    description += `, ${elderly} entrada(s) meias`;
  }

  if (adultsPool > 0 && elderlyPool > 0) {
    description += `, ${adultsPool} acesso(s) a piscina (inteiras) e ${elderlyPool} acesso(s) a piscina (meias)`;
  } else if (adultsPool > 0) {
    description += `, ${adultsPool} acesso(s) a piscina (inteiras)`;
  } else if (elderlyPool > 0) {
    description += `, ${elderlyPool} acesso(s) a piscina (meias)`;
  }

  description += `. Telefone: ${phone}`;
  return description;
}
