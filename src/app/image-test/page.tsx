import { env } from "@/env";
import Image from "next/image";
import { formatQuantity } from "@/lib/voucher";
import { formateDateDayMonthYear, formatPhone, truncateName } from "@/lib/utils";

export default function ImageTestPage() {
  // Mock voucher data for testing
  const mockVoucherData = {
    name: "João Silva Santos",
    phone: "11987654321",
    adults: 2,
    elderly: 2,
    adults_pool: 2,
    elderly_pool: 2,
    price: 150.00,
    status: "valid",
    code: "A1B2",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  };

  // Format the data exactly like the voucher card does
  const formatedExpiredDate = formateDateDayMonthYear(mockVoucherData.expires_at);
  const formatedName = truncateName(mockVoucherData.name);
  const formatedPhone = formatPhone(mockVoucherData.phone);
  const formatedQuantity = formatQuantity({
    adults: mockVoucherData.adults,
    elderly: mockVoucherData.elderly,
    adults_pool: mockVoucherData.adults_pool,
    elderly_pool: mockVoucherData.elderly_pool,
  });

  // Build the URL exactly like the voucher card does
  let url = "";
  if (env.NEXT_PUBLIC_VERCEL_URL) {
    url = `https://${env.NEXT_PUBLIC_VERCEL_URL}`;
  } else if (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    url = `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  } else {
    url = "http://localhost:3000";
  }

  const queryParams = `?name=${encodeURIComponent(formatedName)}&phone=${encodeURIComponent(formatedPhone)}&quantity=${encodeURIComponent(formatedQuantity)}&expires_at=${encodeURIComponent(formatedExpiredDate)}&status=${mockVoucherData.status}&code=${mockVoucherData.code}&price=${mockVoucherData.price}`;
  const imgURL = `${url}/api/og${queryParams}`;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">
            Teste de Geração de Imagem do Voucher
          </h1>
          <p className="text-gray-600">
            Esta página testa a geração da imagem OG com dados mockados
          </p>
        </div>

        <div className="mb-8 rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            Dados do Voucher de Teste:
          </h2>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Nome:</span>
              <span className="text-gray-900">{formatedName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Telefone:</span>
              <span className="text-gray-900">{formatedPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Entradas:</span>
              <span className="text-gray-900">{formatedQuantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Status:</span>
              <span className="text-green-600 font-medium">
                {mockVoucherData.status === "valid" ? "Válido" : mockVoucherData.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Código:</span>
              <span className="text-gray-900 font-mono">{mockVoucherData.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Vence em:</span>
              <span className="text-gray-900">{formatedExpiredDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-600">Preço:</span>
              <span className="text-gray-900 font-medium">
                R$ {mockVoucherData.price.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">
            Imagem Gerada:
          </h2>
          <div className="relative aspect-[2/1] w-full max-w-2xl mx-auto">
            <Image
              className="w-full rounded-lg border"
              src={imgURL}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw"
              alt="Voucher de Teste"
              priority
            />
          </div>

          <div className="mt-4 rounded bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              URL da Imagem:
            </h3>
            <p className="break-all text-xs text-gray-600 font-mono">
              {imgURL}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Esta página é apenas para testes. Acesse{" "}
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              a página inicial
            </a>{" "}
            para usar o sistema normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}