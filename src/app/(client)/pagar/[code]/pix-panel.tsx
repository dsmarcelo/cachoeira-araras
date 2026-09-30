"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * A payable Pix: QR code, copy-and-paste code and its deadline. The caller
 * stops rendering it once `expiresAt` passes, so an expired code is never
 * presented as payable. If the clipboard is blocked, the code stays selected
 * in a read-only field so it can be copied by hand.
 */
export function PixPanel({
  qrCode,
  qrCodeBase64,
  expiresAt,
  now,
}: {
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: number;
  now: number;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const codeField = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
      codeField.current?.focus();
      codeField.current?.select();
    }
  }

  return (
    <section
      aria-label="Pagamento por Pix"
      className="grid gap-4 rounded-xl border border-line-soft bg-surface-alt p-4 text-fg"
    >
      <h2 className="text-lg font-bold">Pague com Pix</h2>
      <p>
        Escaneie o QR Code ou copie o código no aplicativo do seu banco. Pague
        até as {timeFormat.format(expiresAt)} (vence em{" "}
        {formatRemaining(expiresAt - now)}).
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="QR Code do Pix"
        className="mx-auto size-56 bg-white p-2"
        src={`data:image/png;base64,${qrCodeBase64}`}
      />
      <div className="grid gap-2">
        <Label htmlFor="pix-code">Código Pix copia e cola</Label>
        <Input
          id="pix-code"
          className="border-slate-400 text-slate-900"
          ref={codeField}
          readOnly
          value={qrCode}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="brand" onClick={() => void copy()}>
          Copiar código
        </Button>
        {copyState === "copied" && (
          <p role="status" className="text-success-text">
            Código copiado! Cole no aplicativo do seu banco.
          </p>
        )}
        {copyState === "failed" && (
          <p role="alert" className="text-warning-text">
            Não foi possível copiar automaticamente. Selecione o código acima e
            copie manualmente.
          </p>
        )}
      </div>
      <p role="status" className="text-sm text-fg-muted">
        Assim que o pagamento for confirmado, esta página mostrará seu voucher.
      </p>
    </section>
  );
}
