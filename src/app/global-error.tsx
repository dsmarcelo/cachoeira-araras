"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-blue px-4 text-center text-primary-200">
          <h1 className="text-3xl font-bold">Algo deu errado</h1>
          <p className="max-w-md text-base">
            Já recebemos o erro e vamos verificar. Tente carregar a página
            novamente.
          </p>
          <button
            className="rounded-md bg-primary-200 px-4 py-2 font-semibold text-bg-blue"
            onClick={reset}
            type="button"
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
