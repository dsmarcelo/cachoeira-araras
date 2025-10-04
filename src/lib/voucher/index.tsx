import { FaExclamationCircle, FaCheckCircle, FaClock, FaTimesCircle } from 'react-icons/fa';

export function formatVoucherStatus(status: string) {
  if (!status) return <p className="text-red-500">Voucher inválido</p>;
  switch (status) {
    case "pending":
      return <p className="text-yellow-700 w-fit bg-yellow-200/30 rounded-lg px-1 pb-1">Aguardando pagamento</p>
    case "valid":
      return <p className="text-green-500 w-fit bg-green-200/30 rounded-lg px-1 pb-1">Voucher válido</p>;
    case "redeemed":
      return <p className="text-red-500 w-fit bg-red-200/30 rounded-lg px-1 pb-1">Voucher já resgatado</p>;
    case "expired":
      return <p className="text-slate-500 w-fit bg-slate-200/30 rounded-lg px-1 pb-1">Voucher expirado</p>;
    default:
      return <p className="text-red-500 w-fit bg-red-200/30 rounded-lg px-1 pb-1">Voucher inválido</p>;
  }
}

export function formatVoucherStatusWithoutBg(status: string, expiration_date: string) {
  if (!status) return <span style={{ color: 'red' }}>Voucher inválido</span>;

  switch (status) {
    case "pending":
      return <span style={{ color: 'yellow' }}>Aguardando pagamento</span>;
    case "valid":
      return <span style={{ color: '#10b981' }}>Valido até: {expiration_date}</span>;
    case "redeemed":
      return <span style={{ color: 'red' }}>Voucher já resgatado</span>;
    case "expired":
      return <span style={{ color: 'gray' }}>Voucher expirado</span>;
    default:
      return <span style={{ color: 'red' }}>Voucher inválido</span>;
  }
}

export function formatVoucherStatusIcons(status: string) {
  if (!status) {
    return null; // No icon for invalid status
  }

  const iconSize = 16; // Set the desired icon size (adjust as needed)

  switch (status) {
    case "pending":
      return (
        <FaClock className="text-yellow-300" size={iconSize} />
      );
    case "valid":
      return (
        <FaCheckCircle className="text-green-400" size={iconSize} />
      );
    case "redeemed":
      return (
        <FaTimesCircle className="text-red-400" size={iconSize} />
      );
    case "expired":
      return (
        <FaExclamationCircle className="text-slate-300" size={iconSize} />
      );
    default:
      return null; // No icon for unknown status
  }
}

export function formatQuantity({ adults, elderly, adults_pool, elderly_pool }: { adults: number; elderly: number; adults_pool: number; elderly_pool: number; }): string {
  const parts: string[] = [];

  // Format regular access entries
  const adultsText = adults === 1 ? '1 inteira' : `${adults} inteiras`;
  const elderlyText = elderly === 1 ? '1 meia' : `${elderly} meias`;

  if (adults > 0 && elderly > 0) {
    parts.push(`${adultsText} e ${elderlyText}`);
  } else if (adults > 0) {
    parts.push(adultsText);
  } else if (elderly > 0) {
    parts.push(elderlyText);
  }

  // Format pool access entries
  const adultsPoolText = adults_pool === 1 ? '1 inteira (p)' : `${adults_pool} inteiras (p)`;
  const elderlyPoolText = elderly_pool === 1 ? '1 meia (p)' : `${elderly_pool} meias (p)`;

  if (adults_pool > 0 && elderly_pool > 0) {
    parts.push(`${adultsPoolText} e ${elderlyPoolText}`);
  } else if (adults_pool > 0) {
    parts.push(adultsPoolText);
  } else if (elderly_pool > 0) {
    parts.push(elderlyPoolText);
  }

  // Join all parts with commas
  if (parts.length > 0) {
    if (parts.length === 1) {
      return parts[0]!;
    } else if (parts.length === 2) {
      return `${parts[0]} + ${parts[1]}`;
    } else {
      return parts.join(', ');
    }
  } else {
    return 'Nenhuma entrada';
  }
}

export function formatMercadoPagoDescription({ adults, elderly, adults_pool, elderly_pool, phone, code }: { adults: number; elderly: number; adults_pool: number; elderly_pool: number; phone: string; code: string; }): string {
  let description = `Voucher com código ${code}`;

  // Add default access information
  if (adults > 0 && elderly > 0) {
    description += `, ${adults} entrada(s) inteiras e ${elderly} entrada(s) meias`;
  } else if (adults > 0) {
    description += `, ${adults} entrada(s) inteiras`;
  } else if (elderly > 0) {
    description += `, ${elderly} entrada(s) meias`;
  }

  // Add pool access information
  if (adults_pool > 0 && elderly_pool > 0) {
    description += `, ${adults_pool} acesso(s) a piscina (inteiras) e ${elderly_pool} acesso(s) a piscina (meias)`;
  } else if (adults_pool > 0) {
    description += `, ${adults_pool} acesso(s) a piscina (inteiras)`;
  } else if (elderly_pool > 0) {
    description += `, ${elderly_pool} acesso(s) a piscina (meias)`;
  }

  description += `. Telefone: ${phone}`;
  return description;
}
