import { ConvexError, v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  type ActionCtx,
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  paymentSnapshot,
  withoutCardToken,
  type PaymentSnapshot,
} from "./lib/paymentOperation";
import {
  RECOVERY_MIN_AGE_MS,
  recoverUnsettledAttempt,
} from "./voucherReconciliation";
import { isEmbeddedVoucher } from "./lib/embeddedVoucher";
import { describeCardRejection } from "./lib/cardRejection";
import {
  planPix,
  sameDayCardCutoffMs,
  sameDayCardLabel,
  sameDayPixCutoffMs,
  sameDayPixLabel,
} from "./lib/pixWindow";

// Payment Attempts of the embedded (Bricks) checkout. An attempt is one charge
// request for a Voucher; see the `paymentAttempts` table for its meaning.

type AttemptStatus = Doc<"paymentAttempts">["status"];

const attemptStatusValidator = v.union(
  v.literal("creating"),
  v.literal("uncertain"),
  v.literal("pending"),
  v.literal("in_process"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

// Attempts that hold the purchase: no new charge is created while one exists.
// Rejected and cancelled attempts are over and allow a new one.
const blockingStatuses: ReadonlySet<AttemptStatus> = new Set([
  "creating",
  "uncertain",
  "pending",
  "in_process",
]);

const payerValidator = v.object({
  email: v.string(),
  identification: v.optional(
    v.object({ type: v.string(), number: v.string() }),
  ),
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function whyNotPayable(
  voucher: Doc<"vouchers">,
  now: number,
  hasOfficialPayment: boolean,
): string | null {
  if (voucher.status === "valid" || hasOfficialPayment)
    return "O pagamento desta compra já foi aprovado.";
  if (voucher.cancellationStartedAt !== undefined)
    return "Esta compra está em processo de cancelamento e não pode ser paga.";
  if (voucher.status === "cancelled")
    return "Esta compra foi cancelada e não pode mais ser paga.";
  if (voucher.status === "expired" || voucher.expiresAt <= now)
    return "Esta compra expirou e não pode mais ser paga.";
  if (voucher.status === "refunded")
    return "Esta compra foi estornada e não pode mais ser paga.";
  if (voucher.status === "redeemed") return "Este voucher já foi resgatado.";
  if (!isEmbeddedVoucher(voucher))
    return "Esta compra usa outro checkout. Retome o pagamento pelo endereço original.";
  return null;
}

async function findVoucher(ctx: QueryCtx, code: string) {
  const voucher = await ctx.db
    .query("vouchers")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
  return voucher && voucher.deletedAt === undefined ? voucher : null;
}

const notAuthorizedMessage =
  "Não autorizado. O pagamento só pode ser feito no navegador original, onde a compra foi iniciada.";

function isAuthorized(voucher: Doc<"vouchers">, managementToken: string) {
  return (
    voucher.managementToken !== undefined &&
    voucher.managementToken === managementToken
  );
}

type PreparedCharge =
  | { kind: "existing"; attempt: Doc<"paymentAttempts"> }
  | {
      kind: "new";
      voucher: Doc<"vouchers">;
      now: number;
      payer: Payer;
    };
type Payer = {
  email: string;
  identification?: { type: string; number: string };
};

/**
 * Checks shared by every way of paying: authorization, request identity,
 * payer data, Voucher still payable and one blocking attempt per purchase. A
 * repeated `requestId` returns the attempt it already created.
 */
async function prepareCharge(
  ctx: MutationCtx,
  args: {
    code: string;
    managementToken: string;
    requestId: string;
    payer: Payer;
  },
  missingEmailMessage: string,
): Promise<PreparedCharge> {
  const voucher = await findVoucher(ctx, args.code);
  if (!voucher) throw new ConvexError("Voucher não encontrado.");
  if (!isAuthorized(voucher, args.managementToken))
    throw new ConvexError(notAuthorizedMessage);

  if (args.requestId.length < 8 || args.requestId.length > 64)
    throw new ConvexError("Solicitação inválida. Recarregue a página.");
  const email = args.payer.email.trim();
  if (email.length > 254 || !emailPattern.test(email))
    throw new ConvexError(missingEmailMessage);
  const identification = args.payer.identification;
  if (
    identification &&
    (identification.type.length > 20 || identification.number.length > 30)
  )
    throw new ConvexError("Documento inválido. Confira os dados informados.");

  const sameRequest = await ctx.db
    .query("paymentAttempts")
    .withIndex("by_voucherCode_and_requestId", (q) =>
      q.eq("voucherCode", voucher.code).eq("requestId", args.requestId),
    )
    .unique();
  if (sameRequest) return { kind: "existing", attempt: sameRequest };

  const now = Date.now();
  const official = await ctx.db
    .query("payments")
    .withIndex("by_voucherCode_and_isOfficial", (q) =>
      q.eq("voucherCode", voucher.code).eq("isOfficial", true),
    )
    .first();
  const blocked = whyNotPayable(voucher, now, official !== null);
  if (blocked) throw new ConvexError(blocked);

  // Only the newest attempt can still be in progress: a new one is never
  // created while the previous one is.
  const latest = await ctx.db
    .query("paymentAttempts")
    .withIndex("by_voucherCode", (q) => q.eq("voucherCode", voucher.code))
    .order("desc")
    .first();
  const active =
    latest && blockingStatuses.has(latest.status) ? latest : undefined;
  if (active)
    throw new ConvexError(
      active.status === "creating" || active.status === "uncertain"
        ? "Estamos verificando o resultado do seu pagamento anterior. Aguarde antes de tentar novamente."
        : "Você já tem um pagamento em andamento para esta compra.",
    );

  return {
    kind: "new",
    voucher,
    now,
    payer: { email, ...(identification ? { identification } : {}) },
  };
}

const beginResult = v.object({
  attemptId: v.id("paymentAttempts"),
  operationId: v.id("paymentOperations"),
  status: attemptStatusValidator,
});

/**
 * Records the attempt and its recoverable provider operation in the caller's
 * transaction, before the provider is ever called. `prepared` is what
 * `prepareCharge` returned: a resent request yields its existing attempt.
 */
async function recordAttempt(
  ctx: MutationCtx,
  prepared: PreparedCharge,
  input: {
    requestId: string;
    method: Doc<"paymentAttempts">["method"];
    request: Omit<
      Extract<Doc<"paymentOperations">["request"], { kind: "createPayment" }>,
      "kind" | "externalReference" | "amountCents" | "description" | "payer"
    >;
    // Pix only: when the charge stops being payable.
    expiresAt?: number;
  },
): Promise<Infer<typeof beginResult>> {
  if (prepared.kind === "existing")
    return {
      attemptId: prepared.attempt._id,
      operationId: prepared.attempt.operationId,
      status: prepared.attempt.status,
    };
  const { voucher, now, payer } = prepared;
  const operationId = await ctx.db.insert("paymentOperations", {
    request: {
      kind: "createPayment",
      externalReference: voucher.code,
      amountCents: voucher.priceCents,
      description: `Voucher ${voucher.code}`,
      payer,
      ...input.request,
    },
  });
  const attemptId = await ctx.db.insert("paymentAttempts", {
    voucherCode: voucher.code,
    requestId: input.requestId,
    operationId,
    method: input.method,
    status: "creating",
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    createdAt: now,
    updatedAt: now,
  });
  return { attemptId, operationId, status: "creating" };
}

/**
 * Single transaction that decides whether a Pix charge may start and records
 * it, including the same-day Pix cutoff. The attempt and its recoverable
 * provider operation are stored before the provider is ever called.
 */
export const beginPixAttempt = internalMutation({
  args: {
    code: v.string(),
    managementToken: v.string(),
    requestId: v.string(),
    paymentMethodId: v.string(),
    payer: payerValidator,
  },
  returns: beginResult,
  handler: async (ctx, args) => {
    if (args.paymentMethodId !== "pix")
      throw new ConvexError(
        "Este meio de pagamento não está disponível no momento. Escolha o Pix.",
      );
    const prepared = await prepareCharge(
      ctx,
      args,
      "Informe um e-mail válido para gerar o Pix.",
    );
    const plan =
      prepared.kind === "new"
        ? planPix(prepared.voucher.visitDate, prepared.now)
        : undefined;
    if (plan && !plan.allowed)
      throw new ConvexError(
        `Para visitas de hoje, o Pix só pode ser gerado até as ${sameDayPixLabel}. Escolha outra data de visita.`,
      );
    return await recordAttempt(ctx, prepared, {
      requestId: args.requestId,
      method: "pix",
      request: { paymentMethodId: "pix", expiresAt: plan?.expiresAt },
      expiresAt: plan?.expiresAt,
    });
  },
});

// Payment method ids look like "visa" or "master"; the Brick supplies them.
const cardMethodPattern = /^[a-z0-9_]{2,30}$/;
const maxInstallments = 24;
// The Brick's single-use card token and the issuer id are short opaque strings.
const MAX_CARD_TOKEN_LENGTH = 200;
const MAX_ISSUER_ID_LENGTH = 20;

/**
 * Same as `beginPixAttempt` for a credit card charge. The Brick supplies only a
 * single-use token (the card number and CVV never reach the site); the amount
 * is always the Voucher's price, so installment interest never changes it.
 * Same-day visits stop accepting cards at `sameDayCardLabel`.
 */
export const beginCardAttempt = internalMutation({
  args: {
    code: v.string(),
    managementToken: v.string(),
    requestId: v.string(),
    paymentMethodId: v.string(),
    token: v.string(),
    installments: v.number(),
    issuerId: v.optional(v.string()),
    payer: payerValidator,
  },
  returns: beginResult,
  handler: async (ctx, args) => {
    if (
      args.paymentMethodId === "pix" ||
      !cardMethodPattern.test(args.paymentMethodId)
    )
      throw new ConvexError(
        "Não foi possível identificar o cartão. Confira os dados e tente novamente.",
      );
    if (args.token.length === 0 || args.token.length > MAX_CARD_TOKEN_LENGTH)
      throw new ConvexError(
        "Não foi possível ler os dados do cartão. Confira as informações e tente novamente.",
      );
    if (
      !Number.isInteger(args.installments) ||
      args.installments < 1 ||
      args.installments > maxInstallments
    )
      throw new ConvexError(
        "Número de parcelas inválido. Escolha outra quantidade de parcelas.",
      );
    if (
      args.issuerId !== undefined &&
      args.issuerId.length > MAX_ISSUER_ID_LENGTH
    )
      throw new ConvexError(
        "Não foi possível identificar o banco do cartão. Tente novamente.",
      );
    const prepared = await prepareCharge(
      ctx,
      args,
      "Informe um e-mail válido para pagar com cartão.",
    );
    if (prepared.kind === "new") {
      const cutoff = sameDayCardCutoffMs(
        prepared.voucher.visitDate,
        prepared.now,
      );
      if (cutoff !== null && prepared.now >= cutoff)
        throw new ConvexError(
          `Para visitas de hoje, o pagamento com cartão só é aceito até as ${sameDayCardLabel}. Escolha outra data de visita.`,
        );
    }
    return await recordAttempt(ctx, prepared, {
      requestId: args.requestId,
      method: "card",
      request: {
        paymentMethodId: args.paymentMethodId,
        card: {
          token: args.token,
          installments: args.installments,
          ...(args.issuerId ? { issuerId: args.issuerId } : {}),
        },
      },
    });
  },
});

// HTTP statuses where the provider certainly created nothing, so the buyer can
// fix the request and send it again. Anything else may have created a charge.
// 401/403 are our own credential or configuration faults, never the buyer's.
function isDefiniteRefusal(httpStatus: number | undefined) {
  return (
    httpStatus !== undefined &&
    httpStatus >= 400 &&
    httpStatus < 500 &&
    ![401, 403, 408, 409, 425, 429].includes(httpStatus)
  );
}

const technicalFaultMessage =
  "Não conseguimos concluir o pagamento por um problema técnico. Sua compra continua reservada; tente novamente em instantes.";

/** Provider payment status -> attempt status (unknown statuses stay uncertain). */
export function attemptStatusFromProvider(
  providerStatus: string,
): AttemptStatus {
  switch (providerStatus) {
    case "approved":
      return "approved";
    case "pending":
      return "pending";
    case "in_process":
    case "authorized":
    case "in_mediation":
      return "in_process";
    case "rejected":
      return "rejected";
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "cancelled";
    default:
      return "uncertain";
  }
}

/**
 * Applies the provider's answer (or its absence) to an attempt. A failure is
 * `uncertain` unless the provider definitely refused. A created charge that
 * disagrees with our own Voucher data is never trusted and stays uncertain.
 */
export const settleAttempt = internalMutation({
  args: {
    attemptId: v.id("paymentAttempts"),
    payment: v.optional(paymentSnapshot),
  },
  returns: v.object({
    status: attemptStatusValidator,
    message: v.optional(v.string()),
  }),
  handler: async (ctx, { attemptId, payment }) => {
    const attempt = await ctx.db.get("paymentAttempts", attemptId);
    if (!attempt) throw new Error("Payment attempt not found");
    // Only an unsettled attempt takes an answer; a stale reply (a late retry
    // racing a webhook) never undoes what was already recorded.
    if (attempt.status !== "creating" && attempt.status !== "uncertain")
      return { status: attempt.status };
    const now = Date.now();

    if (payment === undefined) {
      const operation = await ctx.db.get(
        "paymentOperations",
        attempt.operationId,
      );
      if (operation && isDefiniteRefusal(operation.lastHttpStatus)) {
        // Refused for good: nothing will be resent, so the card token goes.
        await ctx.db.patch("paymentOperations", operation._id, {
          request: withoutCardToken(operation.request),
        });
        await ctx.db.patch("paymentAttempts", attemptId, {
          status: "rejected",
          statusDetail: operation.lastProviderCode ?? "provider_refused",
          updatedAt: now,
        });
        return {
          status: "rejected" as const,
          message:
            attempt.method === "card"
              ? "Não foi possível processar o cartão. Confira seus dados e tente novamente."
              : "Não foi possível gerar o Pix. Confira seus dados e tente novamente.",
        };
      }
      await ctx.db.patch("paymentAttempts", attemptId, {
        status: "uncertain",
        updatedAt: now,
      });
      const httpStatus = operation?.lastHttpStatus;
      return httpStatus === 401 || httpStatus === 403
        ? { status: "uncertain" as const, message: technicalFaultMessage }
        : { status: "uncertain" as const };
    }

    const voucher = await findVoucher(ctx, attempt.voucherCode);
    const matches =
      voucher !== null &&
      payment.externalReference === voucher.code &&
      Math.round(payment.amount * 100) === voucher.priceCents &&
      payment.currency === "BRL";
    if (!matches) {
      console.error("Created payment does not match its Voucher", {
        code: attempt.voucherCode,
        paymentId: payment.id,
      });
      await ctx.db.patch("paymentAttempts", attemptId, {
        status: "uncertain",
        paymentId: payment.id,
        statusDetail: "verification_failed",
        updatedAt: now,
      });
      return { status: "uncertain" as const };
    }

    const status = attemptStatusFromProvider(payment.status);
    await ctx.db.patch("paymentAttempts", attemptId, {
      status,
      paymentId: payment.id,
      statusDetail: payment.statusDetail,
      ...(payment.expiresAt !== undefined
        ? { expiresAt: payment.expiresAt }
        : {}),
      ...(payment.pix ? { pix: payment.pix } : {}),
      ...(payment.challenge ? { challenge: payment.challenge } : {}),
      updatedAt: now,
    });
    return {
      status,
      ...(status === "rejected"
        ? {
            message:
              attempt.method === "card"
                ? describeCardRejection(payment.statusDetail)
                : "O pagamento foi recusado. Tente novamente.",
          }
        : {}),
    };
  },
});

const chargeResult = v.object({
  status: attemptStatusValidator,
  message: v.optional(v.string()),
});

/**
 * Sends a recorded charge to the provider and settles the attempt with the
 * answer. A resend whose request already has an outcome just reports it.
 */
async function runCharge(
  ctx: ActionCtx,
  begun: Infer<typeof beginResult>,
): Promise<{ status: AttemptStatus; message?: string }> {
  if (begun.status !== "creating" && begun.status !== "uncertain")
    return { status: begun.status };

  let payment: PaymentSnapshot | undefined;
  try {
    const result = await ctx.runAction(internal.paymentOperations.execute, {
      id: begun.operationId,
    });
    // `execute` is shared by every operation kind; a charge returns one payment.
    if (!Array.isArray(result) && "status" in result && "amount" in result)
      payment = result as PaymentSnapshot;
  } catch {
    // The failure is recorded on the operation; settleAttempt decides its meaning.
  }
  return await ctx.runMutation(internal.paymentAttempts.settleAttempt, {
    attemptId: begun.attemptId,
    payment,
  });
}

const closureStep = v.union(
  v.object({ kind: v.literal("clear") }),
  v.object({ kind: v.literal("paid") }),
  // Another tab is creating a charge right now; it is left to finish.
  v.object({ kind: v.literal("busy") }),
  // The latest request has no known charge: run its own operation again.
  v.object({ kind: v.literal("recover") }),
  v.object({
    kind: v.literal("cancel"),
    attemptId: v.id("paymentAttempts"),
    operationId: v.id("paymentOperations"),
  }),
);

/**
 * Decides what must happen before another charge may start: nothing, recover
 * a request whose result was lost, or close the current charge at the
 * provider. The close operation is recorded once on the attempt, so every tab
 * and retry repeats the same one. A `requestId` that already has an attempt is
 * a resend and never closes anything.
 */
export const beginClosure = internalMutation({
  args: {
    code: v.string(),
    managementToken: v.string(),
    requestId: v.optional(v.string()),
  },
  returns: closureStep,
  handler: async (ctx, args) => {
    const voucher = await findVoucher(ctx, args.code);
    if (!voucher) throw new ConvexError("Voucher não encontrado.");
    if (!isAuthorized(voucher, args.managementToken))
      throw new ConvexError(notAuthorizedMessage);

    const { requestId } = args;
    if (requestId !== undefined) {
      const resend = await ctx.db
        .query("paymentAttempts")
        .withIndex("by_voucherCode_and_requestId", (q) =>
          q.eq("voucherCode", voucher.code).eq("requestId", requestId),
        )
        .unique();
      if (resend) return { kind: "clear" as const };
    }
    // Not payable anymore: the charge itself will explain why it is refused.
    if (voucher.status !== "pending") return { kind: "clear" as const };

    const latest = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_voucherCode", (q) => q.eq("voucherCode", voucher.code))
      .order("desc")
      .first();
    if (!latest) return { kind: "clear" as const };
    // Approved but the Voucher is not confirmed yet: never charge again.
    if (latest.status === "approved") return { kind: "paid" as const };
    // A charge under review is not closed for the buyer's convenience; the
    // new charge is refused while it is in progress.
    if (latest.status === "in_process" || !blockingStatuses.has(latest.status))
      return { kind: "clear" as const };

    if (latest.paymentId === undefined) {
      return latest.status === "creating" &&
        Date.now() - latest.updatedAt < RECOVERY_MIN_AGE_MS
        ? { kind: "busy" as const }
        : { kind: "recover" as const };
    }
    let operationId = latest.closeOperationId;
    if (operationId === undefined) {
      operationId = await ctx.db.insert("paymentOperations", {
        request: { kind: "cancel", paymentId: latest.paymentId },
      });
      await ctx.db.patch("paymentAttempts", latest._id, {
        closeOperationId: operationId,
      });
    }
    return { kind: "cancel" as const, attemptId: latest._id, operationId };
  },
});

/** Records that the provider confirmed the end of a charge that was not paid. */
export const markClosed = internalMutation({
  args: {
    attemptId: v.id("paymentAttempts"),
    statusDetail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { attemptId, statusDetail }) => {
    const attempt = await ctx.db.get("paymentAttempts", attemptId);
    if (attempt && blockingStatuses.has(attempt.status))
      await ctx.db.patch("paymentAttempts", attemptId, {
        status: "cancelled",
        ...(statusDetail ? { statusDetail } : {}),
        updatedAt: Date.now(),
      });
    return null;
  },
});

const releaseResult = v.union(
  v.object({ kind: v.literal("released") }),
  v.object({ kind: v.literal("paid") }),
  v.object({ kind: v.literal("blocked"), message: v.string() }),
);
type ReleaseResult = Infer<typeof releaseResult>;

const blockedMessages = {
  busy: "Outro pagamento está sendo iniciado para esta compra. Aguarde alguns segundos e tente novamente.",
  uncertain:
    "Ainda estamos verificando o resultado do pagamento anterior. Aguarde alguns instantes antes de tentar novamente.",
  close:
    "Não conseguimos confirmar o encerramento do pagamento anterior. Sua compra continua reservada; tente novamente em instantes.",
} as const;

/**
 * Makes the purchase free of an open charge, or says why it is not. Another
 * charge may only start after the provider confirms the previous one ended;
 * any failure to check or close leaves the result uncertain and blocks.
 * An approval found on the way wins: the Voucher is confirmed as paid.
 */
async function closeActiveCharge(
  ctx: ActionCtx,
  args: { code: string; managementToken: string; requestId?: string },
): Promise<ReleaseResult> {
  // One recovery of a lost request, then the close of whatever it produced.
  for (let round = 0; round < 2; round++) {
    const step = await ctx.runMutation(internal.paymentAttempts.beginClosure, {
      code: args.code,
      managementToken: args.managementToken,
      requestId: args.requestId,
    });
    switch (step.kind) {
      case "clear":
        return { kind: "released" };
      case "paid":
        return { kind: "paid" };
      case "busy":
        return { kind: "blocked", message: blockedMessages.busy };
      case "recover":
        // A recovery that failed leaves the result uncertain: never retried in
        // the same call, so the provider is not hit twice for one click.
        if (round > 0)
          return { kind: "blocked", message: blockedMessages.uncertain };
        await recoverUnsettledAttempt(ctx, args.code);
        continue;
      case "cancel": {
        let payment: PaymentSnapshot;
        try {
          const result = await ctx.runAction(
            internal.paymentOperations.execute,
            { id: step.operationId },
          );
          if (Array.isArray(result) || !("status" in result))
            return { kind: "blocked", message: blockedMessages.close };
          payment = result as PaymentSnapshot;
        } catch {
          return { kind: "blocked", message: blockedMessages.close };
        }
        if (payment.status === "approved") {
          await ctx.runMutation(internal.vouchers.confirmPayment, {
            code: args.code,
            paymentId: payment.id,
            paymentStatus: "approved",
            paymentAmountCents: Math.round(payment.amount * 100),
            paymentCurrency: payment.currency,
            paymentTypeId: payment.paymentTypeId,
            paymentMethodId: payment.paymentMethodId,
          });
          return { kind: "paid" };
        }
        if (attemptStatusFromProvider(payment.status) !== "cancelled")
          return { kind: "blocked", message: blockedMessages.close };
        await ctx.runMutation(internal.paymentAttempts.markClosed, {
          attemptId: step.attemptId,
          statusDetail: payment.statusDetail,
        });
        return { kind: "released" };
      }
    }
  }
  return { kind: "blocked", message: blockedMessages.uncertain };
}

/**
 * Closes the current charge (for example an expired Pix, or before the buyer
 * picks another way to pay) so the payment page can offer a new one. Never
 * changes the Voucher. Returns `paid` when the provider reports an approval.
 */
export const releaseCharge = action({
  args: { code: v.string(), managementToken: v.string() },
  returns: releaseResult,
  handler: async (ctx, args): Promise<ReleaseResult> =>
    await closeActiveCharge(ctx, args),
});

/**
 * Closes any open charge, then sends the recorded one. A charge that cannot be
 * closed leaves the result `uncertain` and creates nothing; an approval found
 * while closing is reported as `approved`.
 */
async function replaceAndCharge(
  ctx: ActionCtx,
  args: { code: string; managementToken: string; requestId: string },
  begin: () => Promise<Infer<typeof beginResult>>,
): Promise<Infer<typeof chargeResult>> {
  const closed = await closeActiveCharge(ctx, args);
  if (closed.kind === "paid") return { status: "approved" };
  if (closed.kind === "blocked")
    return { status: "uncertain", message: closed.message };
  return await runCharge(ctx, await begin());
}

/**
 * The buyer's request to pay by Pix. The server owns amount, reference,
 * expiry and notification address; the browser only supplies its request
 * identity, the method and the payer's contact data. Refusals throw readable
 * ConvexErrors; a provider failure returns `uncertain` or `rejected` so the
 * page can guide the buyer without losing the purchase.
 */
export const submitPixPayment = action({
  args: {
    code: v.string(),
    managementToken: v.string(),
    requestId: v.string(),
    paymentMethodId: v.string(),
    payer: payerValidator,
  },
  returns: chargeResult,
  handler: async (ctx, args): Promise<Infer<typeof chargeResult>> =>
    await replaceAndCharge(ctx, args, () =>
      ctx.runMutation(internal.paymentAttempts.beginPixAttempt, args),
    ),
});

/**
 * The buyer's request to pay by credit card, from the Payment Brick's token.
 * Amount, reference and notification address are server-owned. `approved`
 * only records the provider's answer: the Voucher becomes Valid through the
 * same verified confirmation as any other payment. `pending` with a
 * `challenge` means the bank asks the buyer to authenticate (3DS).
 */
export const submitCardPayment = action({
  args: {
    code: v.string(),
    managementToken: v.string(),
    requestId: v.string(),
    paymentMethodId: v.string(),
    token: v.string(),
    installments: v.number(),
    issuerId: v.optional(v.string()),
    payer: payerValidator,
  },
  returns: chargeResult,
  handler: async (ctx, args): Promise<Infer<typeof chargeResult>> =>
    await replaceAndCharge(ctx, args, () =>
      ctx.runMutation(internal.paymentAttempts.beginCardAttempt, args),
    ),
});

const publicAttemptValidator = v.object({
  status: attemptStatusValidator,
  statusDetail: v.optional(v.string()),
  method: v.union(v.literal("pix"), v.literal("card")),
  expiresAt: v.optional(v.number()),
  createdAt: v.number(),
  pix: v.optional(v.object({ qrCode: v.string(), qrCodeBase64: v.string() })),
  paymentId: v.optional(v.string()),
  // Bank authentication to complete, only while the charge is still pending.
  challenge: v.optional(
    v.object({ externalResourceUrl: v.string(), creq: v.string() }),
  ),
  // Guidance for a declined card.
  message: v.optional(v.string()),
});

/**
 * Everything the payment page needs, for the holder of the management token
 * only: purchase summary, whether this Voucher is paid through the embedded
 * checkout, the same-day Pix cutoff and the latest Payment Attempt. Never
 * returns payer data.
 */
export const getCheckout = query({
  args: { code: v.string(), managementToken: v.string() },
  returns: v.union(
    v.object({ kind: v.literal("not_found") }),
    v.object({ kind: v.literal("unauthorized") }),
    v.object({
      kind: v.literal("ok"),
      voucher: v.object({
        code: v.string(),
        name: v.string(),
        status: v.string(),
        visitDate: v.string(),
        adults: v.number(),
        elderly: v.number(),
        adultsPool: v.number(),
        elderlyPool: v.number(),
        priceCents: v.number(),
        cancelling: v.boolean(),
      }),
      embedded: v.boolean(),
      // A payment approved after the purchase was cancelled: it is refunded.
      lateApproval: v.boolean(),
      // Same-day visits: no new Pix from this instant (epoch ms), else null.
      pixCutoffAt: v.union(v.number(), v.null()),
      // Same-day visits: no new card charge from this instant, else null.
      cardCutoffAt: v.union(v.number(), v.null()),
      attempt: v.union(publicAttemptValidator, v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const voucher = await findVoucher(ctx, args.code);
    if (!voucher) return { kind: "not_found" as const };
    if (!isAuthorized(voucher, args.managementToken))
      return { kind: "unauthorized" as const };

    const latest = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_voucherCode", (q) => q.eq("voucherCode", voucher.code))
      .order("desc")
      .first();

    return {
      kind: "ok" as const,
      voucher: {
        code: voucher.code,
        name: voucher.name,
        status: voucher.status,
        visitDate: voucher.visitDate,
        adults: voucher.adults,
        elderly: voucher.elderly,
        adultsPool: voucher.adultsPool,
        elderlyPool: voucher.elderlyPool,
        priceCents: voucher.priceCents,
        cancelling: voucher.cancellationStartedAt !== undefined,
      },
      embedded: isEmbeddedVoucher(voucher),
      lateApproval:
        voucher.status === "cancelled" && latest?.status === "approved",
      pixCutoffAt: sameDayPixCutoffMs(voucher.visitDate, Date.now()),
      cardCutoffAt: sameDayCardCutoffMs(voucher.visitDate, Date.now()),
      attempt: latest && {
        status: latest.status,
        statusDetail: latest.statusDetail,
        method: latest.method,
        expiresAt: latest.expiresAt,
        createdAt: latest.createdAt,
        pix: latest.pix,
        paymentId: latest.paymentId,
        challenge: latest.status === "pending" ? latest.challenge : undefined,
        message:
          latest.method === "card" && latest.status === "rejected"
            ? describeCardRejection(latest.statusDetail)
            : undefined,
      },
    };
  },
});
