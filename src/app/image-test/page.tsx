"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Dev-only preview of the voucher OG image (src/app/api/og/route.tsx). The
 * route resolves everything from a real voucher's code server-side, so this
 * page can no longer render a voucher-shaped image with made-up data — it
 * only previews an actual, non-pending voucher by its real code. Fetching
 * the preview goes through the same anonymous `authorizeLookup` rate limit
 * as every other public entry point (see convex/vouchers.ts).
 */
export default function ImageTestPage() {
  const convex = useConvex();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{
    code: string;
    lookupToken: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const targetCode = code.trim();
    if (!targetCode) return;
    setError("");
    setPreview(null);
    const authorization = await convex.mutation(api.vouchers.authorizeLookup, {
      code: targetCode,
    });
    if (authorization.kind === "authorized") {
      setPreview({ code: targetCode, lookupToken: authorization.lookupToken });
    } else if (authorization.kind === "rate_limited") {
      setError("Muitas tentativas de consulta. Aguarde um instante.");
    } else {
      setError("Voucher não encontrado.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Pré-visualização da imagem do voucher
          </h1>
          <p className="text-gray-600">
            Informe o código de um voucher real (não pendente) para ver a
            imagem que ele gera.
          </p>
        </div>

        <form
          className="mb-8 flex gap-2 rounded-lg bg-white p-6 shadow-lg"
          onSubmit={handleSubmit}
        >
          <input
            className="flex-1 rounded border border-gray-300 px-3 py-2"
            placeholder="Código do voucher"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            disabled={!code.trim()}
          >
            Visualizar
          </button>
        </form>

        {error && <p className="mb-4 text-center text-red-600">{error}</p>}

        {preview && (
          <div className="rounded-lg bg-white p-6 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element -- previewing a dynamically generated, non-optimizable OG image */}
            <img
              className="w-full rounded-lg border"
              src={`/api/og?code=${encodeURIComponent(preview.code)}&lookupToken=${encodeURIComponent(preview.lookupToken)}`}
              alt={`Voucher ${preview.code}`}
            />
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Esta página é apenas para testes. Acesse{" "}
            <Link
              href="/"
              className="text-blue-600 underline hover:text-blue-800"
            >
              a página inicial
            </Link>{" "}
            para usar o sistema normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}
