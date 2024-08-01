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
