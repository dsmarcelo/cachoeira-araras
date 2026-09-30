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
import { paymentSnapshot, type PaymentSnapshot } from "./lib/paymentOperation";
import { describeCardRejection } from "./lib/cardRejection";
import {
  planPix,
  sameDayCardCutoffMs,
  sameDayPixCutoffMs,
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
  if (voucher.preferenceId !== undefined)
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
    if (prepared.kind === "existing")
      return {
        attemptId: prepared.attempt._id,
        operationId: prepared.attempt.operationId,
        status: prepared.attempt.status,
      };
    const { voucher, now, payer } = prepared;

    const plan = planPix(voucher.visitDate, now);
    if (!plan.allowed)
      throw new ConvexError(
        "Para visitas de hoje, o Pix só pode ser gerado até as 16h30. Escolha outra data de visita.",
      );

    const operationId = await ctx.db.insert("paymentOperations", {
      request: {
        kind: "createPayment",
        externalReference: voucher.code,
        amountCents: voucher.priceCents,
        description: `Voucher ${voucher.code}`,
        paymentMethodId: "pix",
        payer,
        expiresAt: plan.expiresAt,
      },
    });
    const attemptId = await ctx.db.insert("paymentAttempts", {
      voucherCode: voucher.code,
      requestId: args.requestId,
      operationId,
      method: "pix",
      status: "creating",
      expiresAt: plan.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    return { attemptId, operationId, status: "creating" as const };
  },
});

const cardMethodPattern = /^[a-z0-9_]{2,30}$/;
const maxInstallments = 24;

/**
 * Same as `beginPixAttempt` for a credit card charge. The Brick supplies only a
 * single-use token (the card number and CVV never reach the site); the amount
 * is always the Voucher's price, so installment interest never changes it.
 * Same-day visits stop accepting cards at 17h.
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
    if (args.token.length === 0 || args.token.length > 200)
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
    if (args.issuerId !== undefined && args.issuerId.length > 20)
      throw new ConvexError(
        "Não foi possível identificar o banco do cartão. Tente novamente.",
      );
    const prepared = await prepareCharge(
      ctx,
      args,
      "Informe um e-mail válido para pagar com cartão.",
    );
    if (prepared.kind === "existing")
      return {
        attemptId: prepared.attempt._id,
        operationId: prepared.attempt.operationId,
        status: prepared.attempt.status,
      };
    const { voucher, now, payer } = prepared;

    const cutoff = sameDayCardCutoffMs(voucher.visitDate, now);
    if (cutoff !== null && now >= cutoff)
      throw new ConvexError(
        "Para visitas de hoje, o pagamento com cartão só é aceito até as 17h. Escolha outra data de visita.",
      );

    const operationId = await ctx.db.insert("paymentOperations", {
      request: {
        kind: "createPayment",
        externalReference: voucher.code,
        amountCents: voucher.priceCents,
        description: `Voucher ${voucher.code}`,
        paymentMethodId: args.paymentMethodId,
        payer,
        card: {
          token: args.token,
          installments: args.installments,
          ...(args.issuerId ? { issuerId: args.issuerId } : {}),
        },
      },
    });
    const attemptId = await ctx.db.insert("paymentAttempts", {
      voucherCode: voucher.code,
      requestId: args.requestId,
      operationId,
      method: "card",
      status: "creating",
      createdAt: now,
      updatedAt: now,
    });
    return { attemptId, operationId, status: "creating" as const };
  },
});

// HTTP statuses where the provider certainly created nothing, so the buyer can
// fix the request and send it again. Anything else may have created a charge.
function isDefiniteRefusal(httpStatus: number | undefined) {
  return (
    httpStatus !== undefined &&
    httpStatus >= 400 &&
    httpStatus < 500 &&
    ![408, 409, 425, 429].includes(httpStatus)
  );
}

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
    const now = Date.now();

    if (payment === undefined) {
      const operation = await ctx.db.get(
        "paymentOperations",
        attempt.operationId,
      );
      if (isDefiniteRefusal(operation?.lastHttpStatus)) {
        await ctx.db.patch("paymentAttempts", attemptId, {
          status: "rejected",
          statusDetail: operation?.lastProviderCode ?? "provider_refused",
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
      return { status: "uncertain" as const };
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
    await runCharge(
      ctx,
      await ctx.runMutation(internal.paymentAttempts.beginPixAttempt, args),
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
    await runCharge(
      ctx,
      await ctx.runMutation(internal.paymentAttempts.beginCardAttempt, args),
    ),
});

const publicAttemptValidator = v.object({
  status: attemptStatusValidator,
  statusDetail: v.optional(v.string()),
  method: v.union(v.literal("pix"), v.literal("card")),
  expiresAt: v.optional(v.number()),
  createdAt: v.number(),
  pix: v.optional(v.object({ qrCode: v.string(), qrCodeBase64: v.string() })),
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
      embedded:
        voucher.preferenceId === undefined && voucher.initPoint === undefined,
      pixCutoffAt: sameDayPixCutoffMs(voucher.visitDate, Date.now()),
      cardCutoffAt: sameDayCardCutoffMs(voucher.visitDate, Date.now()),
      attempt: latest && {
        status: latest.status,
        statusDetail: latest.statusDetail,
        method: latest.method,
        expiresAt: latest.expiresAt,
        createdAt: latest.createdAt,
        pix: latest.pix,
        challenge: latest.status === "pending" ? latest.challenge : undefined,
        message:
          latest.method === "card" && latest.status === "rejected"
            ? describeCardRejection(latest.statusDetail)
            : undefined,
      },
    };
  },
});
