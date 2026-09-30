"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

import { useSavedVouchers } from "@/app/_components/saved-vouchers-provider";
import { Button } from "@/components/ui/button";
import { capturePaymentFlowException } from "@/lib/sentry/payment";
import { getCachedManagementToken } from "@/lib/voucher/management-token-cache";
import { formatToBRL, getErrorMessage } from "@/lib/utils";
import { api } from "../../../../../convex/_generated/api";
import { CardChallenge } from "./card-challenge";
import { PixPanel } from "./pix-panel";

const RECONCILE_INTERVAL_MS = 15_000;
const SLOW_LOAD_MS = 10_000;

const terminalMessages: Record<string, string> = {
  cancelled: "Esta compra foi cancelada e não pode mais ser paga.",
  expired: "Esta compra expirou e não pode mais ser paga.",
  refunded: "Esta compra foi estornada e não pode mais ser paga.",
  redeemed: "Este voucher já foi utilizado.",
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** True once `active` has lasted `delayMs`, e.g. to explain a slow connection. */
function useElapsed(active: boolean, delayMs: number) {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return;
    }
    const id = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(id);
  }, [active, delayMs]);
  return elapsed;
}

function newRequestId() {
  return crypto.randomUUID();
}

function Notice({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-lg gap-3 p-6 text-center text-fg">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

type Summary = {
  name: string;
  visitDate: string;
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
  priceCents: number;
};

function PurchaseSummary({ voucher }: { voucher: Summary }) {
  const [year, month, day] = voucher.visitDate.split("-");
  const parts = [
    voucher.adults > 0 && `${voucher.adults} inteiras`,
    voucher.elderly > 0 && `${voucher.elderly} meias`,
    voucher.adultsPool > 0 && `${voucher.adultsPool} piscina`,
    voucher.elderlyPool > 0 && `${voucher.elderlyPool} meias com piscina`,
  ].filter(Boolean);
  return (
    <section
      aria-label="Resumo da compra"
      className="grid gap-1 rounded-xl border border-border p-4"
    >
      <h2 className="text-lg font-bold">Resumo da compra</h2>
      <p>{voucher.name}</p>
      <p>
        Visita em {day}/{month}/{year}
      </p>
      <p>{parts.join(", ")}</p>
      <p className="text-xl font-bold">
        {formatToBRL(voucher.priceCents / 100)}
      </p>
    </section>
  );
}

/**
 * The internal payment page of an embedded (Bricks) purchase, opened with the
 * Voucher Code. Payment is only ever requested with the management token this
 * browser saved when the purchase began; the server decides price, deadlines
 * and whether a charge may start, and this page reflects that state reactively.
 */
export function EmbeddedCheckout({
  code,
  publicKey,
}: {
  code: string;
  publicKey: string | undefined;
}) {
  const router = useRouter();
  const { vouchers, ready } = useSavedVouchers();
  const savedToken = vouchers.find((v) => v.code === code)?.managementToken;
  const managementToken = savedToken ?? getCachedManagementToken(code);
  const data = useQuery(
    api.paymentAttempts.getCheckout,
    managementToken ? { code, managementToken } : "skip",
  );
  const submitPix = useAction(api.paymentAttempts.submitPixPayment);
  const submitCard = useAction(api.paymentAttempts.submitCardPayment);
  const reconcile = useAction(api.voucherReconciliation.reconcileMine);
  const releaseCharge = useAction(api.paymentAttempts.releaseCharge);
  const cancelPurchase = useAction(api.vouchers.cancelPendingPurchase);
  const now = useNow();

  const [brickReady, setBrickReady] = useState(false);
  const [brickFailed, setBrickFailed] = useState(false);
  const [brickKey, setBrickKey] = useState(0);
  const [submitError, setSubmitError] = useState("");
  // The last provider check failed (connection or provider); it says nothing
  // about whether a charge exists, so the purchase stays blocked.
  const [checkFailed, setCheckFailed] = useState(false);
  // One identity per submission: a resend keeps it, a refusal starts a new one.
  const requestId = useRef<string | null>(null);
  // Closing the open charge (renew, switch method) or cancelling the purchase.
  const [busy, setBusy] = useState<"release" | "cancel" | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [actionError, setActionError] = useState("");

  const isEmbeddedPending =
    data?.kind === "ok" && data.embedded && data.voucher.status === "pending";
  const attemptStatus = data?.kind === "ok" ? data.attempt?.status : undefined;
  // `approved` still waits for the server's verified confirmation of the Voucher.
  const isAwaitingProvider =
    attemptStatus === "approved" ||
    attemptStatus === "pending" ||
    attemptStatus === "in_process" ||
    attemptStatus === "uncertain" ||
    attemptStatus === "creating";
  const isPaid =
    data?.kind === "ok" &&
    (data.voucher.status === "valid" || data.voucher.status === "redeemed");

  useEffect(() => {
    if (publicKey) initMercadoPago(publicKey, { locale: "pt-BR" });
  }, [publicKey]);

  useEffect(() => {
    if (isPaid) router.replace(`/pagamento?external_reference=${code}`);
  }, [isPaid, router, code]);

  // Webhooks cannot always reach this environment, so the originating browser
  // also asks the server (throttled there) to confirm a pending charge.
  useEffect(() => {
    if (!isEmbeddedPending || !isAwaitingProvider || !managementToken) return;
    const check = () =>
      void reconcile({ code, managementToken })
        .then(() => setCheckFailed(false))
        .catch((error) => {
          capturePaymentFlowException(error, "confirm_voucher", { code });
          setCheckFailed(true);
        });
    check();
    const id = setInterval(check, RECONCILE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isEmbeddedPending, isAwaitingProvider, managementToken, code, reconcile]);

  const isLoading = !ready || (Boolean(managementToken) && data === undefined);
  const loadingIsSlow = useElapsed(isLoading, SLOW_LOAD_MS);
  const priceCents = data?.kind === "ok" ? data.voucher.priceCents : 0;
  // Stable across reactive updates so the Brick is not re-initialized.
  const brickInitialization = useMemo(
    () => ({ amount: priceCents / 100 }),
    [priceCents],
  );
  const pixOpen =
    data?.kind !== "ok" || data.pixCutoffAt === null || now < data.pixCutoffAt;
  const cardOpen =
    data?.kind !== "ok" ||
    data.cardCutoffAt === null ||
    now < data.cardCutoffAt;
  // Only credit card and Pix: boleto, debit and Mercado Pago account/credit
  // (which redirect the buyer) are left out. Installment limits are not set,
  // so the account's own conditions apply.
  const brickCustomization = useMemo(
    () => ({
      paymentMethods: cardOpen
        ? pixOpen
          ? { creditCard: "all" as const, bankTransfer: ["pix"] }
          : { creditCard: "all" as const }
        : { bankTransfer: ["pix"] },
    }),
    [cardOpen, pixOpen],
  );

  if (isLoading) {
    return (
      <Notice title="Carregando sua compra...">
        {loadingIsSlow && (
          <p role="alert" className="text-warning-text">
            Está demorando mais que o normal. Confira sua conexão: sua compra
            continua salva.
          </p>
        )}
      </Notice>
    );
  }
  if (!managementToken || data?.kind === "unauthorized") {
    return (
      <Notice title="Não foi possível abrir esta compra">
        <p>
          O pagamento só pode ser feito no navegador onde a compra foi iniciada.
          Se você trocou de navegador ou aparelho, volte ao original ou fale com
          a nossa equipe.
        </p>
        <Button asChild variant="brand">
          <Link href="/meus-vouchers">Ver meus vouchers</Link>
        </Button>
      </Notice>
    );
  }
  if (data?.kind !== "ok") {
    return (
      <Notice title="Compra não encontrada">
        <p>Confira o endereço ou consulte seus vouchers.</p>
      </Notice>
    );
  }
  if (isPaid)
    return <Notice title="Pagamento aprovado! Abrindo seu voucher..." />;

  const { voucher, attempt, pixCutoffAt } = data;
  if (!data.embedded) {
    return (
      <Notice title="Esta compra usa outro checkout">
        <Button asChild variant="brand">
          <Link href="/meus-vouchers">Retomar pelos meus vouchers</Link>
        </Button>
      </Notice>
    );
  }
  const unpayable = voucher.cancelling
    ? "Esta compra está em processo de cancelamento e não pode ser paga."
    : data.lateApproval
      ? "Esta compra foi cancelada, mas recebemos um pagamento depois do cancelamento. Ele será estornado integralmente."
      : terminalMessages[voucher.status];

  /** Closes the open charge at the provider so another way to pay can be offered. */
  async function handleRelease() {
    if (!managementToken) return;
    setBusy("release");
    setActionError("");
    try {
      const result = await releaseCharge({ code, managementToken });
      if (result.kind === "blocked") setActionError(result.message);
      else requestId.current = null;
    } catch (error) {
      capturePaymentFlowException(error, "release_charge", { code });
      setActionError(
        getErrorMessage(
          error,
          "Não foi possível encerrar o pagamento anterior. Tente novamente.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    if (!managementToken) return;
    setBusy("cancel");
    setActionError("");
    try {
      const result = await cancelPurchase({ code, managementToken });
      if (result.kind === "error" || result.kind === "unauthorized")
        setActionError(result.message);
      setConfirmingCancel(false);
    } catch (error) {
      capturePaymentFlowException(error, "cancel_purchase", { code });
      setActionError(
        getErrorMessage(
          error,
          "Não foi possível cancelar a compra agora. Tente novamente em instantes.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(formData: {
    payment_method_id?: string;
    token?: string;
    installments?: number;
    issuer_id?: string | number;
    payer?: {
      email?: string;
      identification?: { type?: string; number?: string };
    };
  }) {
    if (!managementToken) return;
    setSubmitError("");
    requestId.current ??= newRequestId();
    const identification = formData.payer?.identification;
    const charge = {
      code,
      managementToken,
      requestId: requestId.current,
      paymentMethodId: formData.payment_method_id ?? "",
      payer: {
        email: formData.payer?.email ?? "",
        ...(identification?.type && identification.number
          ? {
              identification: {
                type: identification.type,
                number: identification.number,
              },
            }
          : {}),
      },
    };
    try {
      // The card number and CVV stay inside the Brick: only its token is sent.
      const result =
        charge.paymentMethodId === "pix"
          ? await submitPix(charge)
          : await submitCard({
              ...charge,
              token: formData.token ?? "",
              installments: formData.installments ?? 1,
              ...(formData.issuer_id !== undefined
                ? { issuerId: String(formData.issuer_id) }
                : {}),
            });
      if (result.status === "rejected") {
        requestId.current = null;
        throw new Error(result.message ?? "Pagamento recusado.");
      }
    } catch (error) {
      capturePaymentFlowException(error, "create_payment", { code });
      setSubmitError(
        error instanceof Error && !("data" in error)
          ? error.message
          : getErrorMessage(
              error,
              "Não foi possível gerar o pagamento. Tente novamente.",
            ),
      );
      throw error;
    }
  }

  let payment: React.ReactNode;
  if (unpayable) {
    payment = (
      <p role="alert" className="text-warning-text">
        {unpayable}
      </p>
    );
  } else if (
    attempt?.status === "creating" ||
    attempt?.status === "uncertain"
  ) {
    payment = (
      <p role="status">
        Estamos verificando o seu pagamento. Não pague de novo: se o resultado
        não aparecer em alguns minutos, volte a esta página mais tarde ou fale
        com a nossa equipe informando o código {voucher.code}.
      </p>
    );
    payment = (
      <div className="grid gap-3">
        {payment}
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void handleRelease()}
        >
          Verificar novamente
        </Button>
      </div>
    );
  } else if (
    attempt?.status === "pending" &&
    attempt.challenge &&
    attempt.paymentId
  ) {
    payment = (
      <CardChallenge
        code={code}
        paymentId={attempt.paymentId}
        challenge={attempt.challenge}
      />
    );
  } else if (
    attempt?.status === "in_process" ||
    (attempt?.status === "pending" && attempt.method === "card")
  ) {
    payment = (
      <p role="status">
        Seu pagamento está em análise. Não pague de novo: assim que for
        concluído, mostraremos seu voucher aqui.
      </p>
    );
  } else if (attempt?.status === "approved") {
    payment = (
      <p role="status">
        Pagamento aprovado! Estamos confirmando sua compra e abrindo o seu
        voucher.
      </p>
    );
  } else if (
    attempt?.status === "pending" &&
    attempt.pix &&
    attempt.expiresAt !== undefined
  ) {
    payment =
      now < attempt.expiresAt ? (
        <div className="grid gap-3">
          <PixPanel
            qrCode={attempt.pix.qrCode}
            qrCodeBase64={attempt.pix.qrCodeBase64}
            expiresAt={attempt.expiresAt}
            now={now}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void handleRelease()}
          >
            Trocar forma de pagamento
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p role="alert" className="text-warning-text">
            O código Pix venceu e não pode mais ser pago. Sua compra continua
            reservada com o mesmo valor: gere um novo código ou pague com
            cartão.
          </p>
          <Button
            type="button"
            variant="brand"
            disabled={busy !== null}
            onClick={() => void handleRelease()}
          >
            {busy === "release" ? "Encerrando..." : "Gerar novo código"}
          </Button>
        </div>
      );
  } else if (!pixOpen && !cardOpen) {
    payment = (
      <p role="alert" className="text-warning-text">
        Para visitas de hoje, o Pix só pode ser gerado até as 16h30 e o cartão é
        aceito até as 17h. Escolha outra data de visita em uma nova compra.
      </p>
    );
  } else {
    payment = (
      <div className="grid gap-3">
        {pixCutoffAt !== null && (
          <p className="text-sm text-fg-muted">
            {pixOpen
              ? "Para visitas de hoje, o Pix só pode ser gerado até as 16h30 e o cartão é aceito até as 17h."
              : "Para visitas de hoje, o Pix só pode ser gerado até as 16h30. O cartão continua disponível até as 17h."}
          </p>
        )}
        {attempt?.status === "cancelled" && !submitError && (
          <p role="status" className="text-sm text-fg-muted">
            O pagamento anterior foi encerrado e nada será cobrado dele. Escolha
            como pagar: sua compra continua reservada com o mesmo valor.
          </p>
        )}
        {attempt?.status === "rejected" && !submitError && (
          <p role="alert" className="text-sm text-warning-text">
            {attempt.message ??
              "O pagamento anterior não foi concluído. Você pode tentar novamente."}{" "}
            Sua compra continua reservada com o mesmo valor.
          </p>
        )}
        {submitError && (
          <p role="alert" className="text-warning-text">
            {submitError}
          </p>
        )}
        {!publicKey ? (
          <p role="alert" className="text-warning-text">
            O pagamento pelo site está indisponível no momento. Tente novamente
            mais tarde.
          </p>
        ) : brickFailed ? (
          <div role="alert" className="grid gap-2 text-warning-text">
            <p>
              Não foi possível carregar o formulário de pagamento. Sua compra
              continua salva.
            </p>
            <Button
              type="button"
              variant="brand"
              onClick={() => {
                setBrickFailed(false);
                setBrickReady(false);
                setBrickKey((key) => key + 1);
              }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {!brickReady && (
              <p role="status">Carregando o formulário de pagamento...</p>
            )}
            <Payment
              key={brickKey}
              locale="pt-BR"
              initialization={brickInitialization}
              customization={brickCustomization}
              onReady={() => setBrickReady(true)}
              onError={(error) => {
                capturePaymentFlowException(error, "load_brick", { code });
                // Field problems are explained by the Brick itself, next to
                // the field, and keep the rest of the form.
                if (error.type === "critical") setBrickFailed(true);
              }}
              onSubmit={({ formData }) => handleSubmit(formData)}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-lg gap-4 p-4 text-fg">
      <h1 className="text-2xl font-bold">
        Pagamento do voucher {voucher.code}
      </h1>
      {!savedToken && (
        <p role="alert" className="text-warning-text">
          Não foi possível salvar esta compra neste navegador. Anote o código{" "}
          <strong>{voucher.code}</strong> e finalize o pagamento sem fechar esta
          página.
        </p>
      )}
      <PurchaseSummary voucher={voucher} />
      {isAwaitingProvider && checkFailed && (
        <p role="alert" className="text-warning-text">
          Não conseguimos verificar o pagamento agora. Tentaremos de novo
          automaticamente; não é preciso pagar outra vez.
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-warning-text">
          {actionError}
        </p>
      )}
      {payment}
      {!unpayable && (
        <div className="grid gap-2 border-t border-border pt-4">
          {confirmingCancel ? (
            <>
              <p>
                Cancelar a compra encerra qualquer pagamento em aberto e libera
                o voucher {voucher.code}. Deseja mesmo cancelar?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy !== null}
                  onClick={() => void handleCancel()}
                >
                  {busy === "cancel" ? "Cancelando..." : "Sim, cancelar compra"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => setConfirmingCancel(false)}
                >
                  Voltar
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              disabled={busy !== null}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancelar compra
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
