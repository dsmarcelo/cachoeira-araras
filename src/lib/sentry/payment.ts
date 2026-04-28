import * as Sentry from "@sentry/nextjs";

type Primitive = string | number | boolean;
type PaymentFlowContext = Record<string, unknown>;

type PaymentFlowStep =
  | "create_preference"
  | "fetch_preference"
  | "fetch_payment"
  | "payment_return"
  | "confirm_voucher"
  | "webhook";

const sensitiveKeyPattern =
  /authorization|cookie|email|name|phone|secret|signature|surname|token/i;

function sanitizeContext(
  context?: PaymentFlowContext,
): Record<string, Primitive> {
  if (!context) return {};

  return Object.fromEntries(
    Object.entries(context).flatMap(([key, value]) => {
      if (sensitiveKeyPattern.test(key)) return [];

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [[key, value]];
      }

      if (value === null) {
        return [[key, "null"]];
      }

      if (value instanceof Date) {
        return [[key, value.toISOString()]];
      }

      return [[key, String(value)]];
    }),
  );
}

function applyPaymentFlowScope(
  scope: Sentry.Scope,
  step: PaymentFlowStep,
  context?: PaymentFlowContext,
) {
  const safeContext = sanitizeContext(context);

  scope.setTag("payment.provider", "mercadopago");
  scope.setTag("payment.flow_step", step);
  scope.setContext("payment_flow", safeContext);

  for (const [key, value] of Object.entries(safeContext)) {
    scope.setTag(`payment.${key}`, value);
  }
}

export function capturePaymentFlowException(
  error: unknown,
  step: PaymentFlowStep,
  context?: PaymentFlowContext,
) {
  Sentry.withScope((scope) => {
    applyPaymentFlowScope(scope, step, context);
    Sentry.captureException(error);
  });
}

export function capturePaymentFlowMessage(
  message: string,
  step: PaymentFlowStep,
  context?: PaymentFlowContext,
  level: Sentry.SeverityLevel = "warning",
) {
  Sentry.withScope((scope) => {
    applyPaymentFlowScope(scope, step, context);
    scope.setLevel(level);
    Sentry.captureMessage(message);
  });
}

export async function startPaymentFlowSpan<T>(
  step: PaymentFlowStep,
  description: string,
  context: PaymentFlowContext | undefined,
  callback: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name: `payment.${step}`,
      op: "payment.flow",
      attributes: {
        ...sanitizeContext(context),
        description,
      },
    },
    callback,
  );
}
