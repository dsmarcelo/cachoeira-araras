import { describe, expect, test } from "vitest";

import {
  decideReversalPatch,
  type ProviderPaymentState,
  type VoucherReversalState,
} from "./paymentReversal";

const now = Date.UTC(2026, 8, 10, 12);
const future = now + 1000 * 60 * 60;
const past = now - 1000 * 60 * 60;

function voucher(
  overrides: Partial<VoucherReversalState> = {},
): VoucherReversalState {
  return { status: "valid", expiresAt: future, ...overrides };
}

function decide(state: VoucherReversalState, provider: ProviderPaymentState) {
  return decideReversalPatch(state, provider, now);
}

const chargebackReversal = { reason: "charged_back", notedAt: 1 };

describe("approved", () => {
  test("accredited leaves the voucher unchanged", () => {
    expect(
      decide(voucher(), { status: "approved", statusDetail: "accredited" }),
    ).toBeNull();
  });

  test("accredited clears a dispute flag", () => {
    const paymentIssue = {
      kind: "dispute" as const,
      status: "in_mediation",
      notedAt: 1,
    };
    expect(
      decide(voucher({ paymentIssue }), {
        status: "approved",
        statusDetail: "accredited",
      }),
    ).toEqual({ paymentIssue: undefined });
  });

  test("partially_refunded flags a partial refund with the refunded amount", () => {
    expect(
      decide(voucher(), {
        status: "approved",
        statusDetail: "partially_refunded",
        refundedCents: 1500,
      }),
    ).toEqual({
      paymentIssue: {
        kind: "partial_refund",
        status: "approved",
        statusDetail: "partially_refunded",
        refundedCents: 1500,
        notedAt: now,
      },
    });
  });

  test("a partial refund already flagged with the same amount changes nothing", () => {
    const paymentIssue = {
      kind: "partial_refund" as const,
      status: "approved",
      statusDetail: "partially_refunded",
      refundedCents: 1500,
      notedAt: 5,
    };
    expect(
      decide(voucher({ paymentIssue }), {
        status: "approved",
        statusDetail: "partially_refunded",
        refundedCents: 1500,
      }),
    ).toBeNull();
  });

  test("a larger refunded amount updates the flag and keeps its first date", () => {
    const paymentIssue = {
      kind: "partial_refund" as const,
      status: "approved",
      statusDetail: "partially_refunded",
      refundedCents: 1500,
      notedAt: 5,
    };
    expect(
      decide(voucher({ paymentIssue }), {
        status: "approved",
        statusDetail: "partially_refunded",
        refundedCents: 2500,
      }),
    ).toEqual({ paymentIssue: { ...paymentIssue, refundedCents: 2500 } });
  });

  test("does not undo an existing reversal", () => {
    expect(
      decide(voucher({ status: "refunded", reversal: chargebackReversal }), {
        status: "approved",
        statusDetail: "accredited",
      }),
    ).toBeNull();
  });
});

describe("dispute", () => {
  test("in_mediation flags a dispute and leaves the status alone", () => {
    expect(
      decide(voucher(), {
        status: "in_mediation",
        statusDetail: "in_mediation",
      }),
    ).toEqual({
      paymentIssue: {
        kind: "dispute",
        status: "in_mediation",
        statusDetail: "in_mediation",
        notedAt: now,
      },
    });
  });

  test("an undecided chargeback flags a dispute and leaves the status alone", () => {
    expect(
      decide(voucher(), {
        status: "charged_back",
        statusDetail: "in_process",
        chargebackOutcome: "open",
      }),
    ).toEqual({
      paymentIssue: {
        kind: "dispute",
        status: "charged_back",
        statusDetail: "in_process",
        notedAt: now,
      },
    });
  });

  test("a dispute already flagged keeps its first date when the detail changes", () => {
    const paymentIssue = {
      kind: "dispute" as const,
      status: "in_mediation",
      notedAt: 5,
    };
    expect(
      decide(voucher({ paymentIssue }), {
        status: "charged_back",
        statusDetail: "in_process",
        chargebackOutcome: "open",
      }),
    ).toEqual({
      paymentIssue: {
        kind: "dispute",
        status: "charged_back",
        statusDetail: "in_process",
        notedAt: 5,
      },
    });
  });

  test("a dispute is not flagged on a voucher that was already reversed", () => {
    expect(
      decide(
        voucher({
          status: "redeemed",
          reversal: { reason: "refunded", notedAt: 1 },
        }),
        { status: "charged_back", chargebackOutcome: "open" },
      ),
    ).toBeNull();
  });

  test("other in-flight statuses change nothing", () => {
    for (const status of ["in_process", "pending", "authorized", "rejected"]) {
      expect(decide(voucher(), { status })).toBeNull();
    }
    expect(decide(voucher(), { status: null })).toBeNull();
  });
});

describe("lost chargeback", () => {
  test("a valid voucher becomes refunded with a revertible reversal", () => {
    expect(
      decide(voucher(), { status: "charged_back", chargebackOutcome: "lost" }),
    ).toEqual({
      status: "refunded",
      reversal: { reason: "charged_back", notedAt: now },
    });
  });

  test("a chargeback with no case information is only flagged as a dispute", () => {
    expect(decide(voucher(), { status: "charged_back" })).toEqual({
      paymentIssue: expect.objectContaining({ kind: "dispute" }),
    });
  });

  test("clears the dispute flag", () => {
    const paymentIssue = {
      kind: "dispute" as const,
      status: "charged_back",
      notedAt: 1,
    };
    expect(
      decide(voucher({ paymentIssue }), {
        status: "charged_back",
        chargebackOutcome: "lost",
      }),
    ).toMatchObject({ status: "refunded", paymentIssue: undefined });
  });

  test("a redeemed voucher keeps its status and records a reversal", () => {
    expect(
      decide(voucher({ status: "redeemed" }), {
        status: "charged_back",
        chargebackOutcome: "lost",
      }),
    ).toEqual({ reversal: { reason: "charged_back", notedAt: now } });
  });

  test("an expired voucher keeps its status and records a reversal", () => {
    expect(
      decide(voucher({ status: "expired", expiresAt: past }), {
        status: "charged_back",
        chargebackOutcome: "lost",
      }),
    ).toEqual({ reversal: { reason: "charged_back", notedAt: now } });
  });

  test("is idempotent once reversed", () => {
    expect(
      decide(voucher({ status: "refunded", reversal: chargebackReversal }), {
        status: "charged_back",
        chargebackOutcome: "lost",
      }),
    ).toBeNull();
  });
});

describe("won chargeback", () => {
  const won: ProviderPaymentState = {
    status: "charged_back",
    chargebackOutcome: "won",
  };

  test("clears the dispute flag and changes nothing else", () => {
    const paymentIssue = {
      kind: "dispute" as const,
      status: "charged_back",
      notedAt: 1,
    };
    expect(decide(voucher({ paymentIssue }), won)).toEqual({
      paymentIssue: undefined,
    });
  });

  test("with nothing to undo it changes nothing", () => {
    expect(decide(voucher(), won)).toBeNull();
  });

  test("reverts a chargeback-caused refund to valid", () => {
    expect(
      decide(voucher({ status: "refunded", reversal: chargebackReversal }), won),
    ).toEqual({ status: "valid", reversal: undefined });
  });

  test("reverts to expired when the voucher is past its expiry", () => {
    expect(
      decide(
        voucher({
          status: "refunded",
          expiresAt: past,
          reversal: chargebackReversal,
        }),
        won,
      ),
    ).toEqual({ status: "expired", reversal: undefined });
  });

  test("clears the reversal on a redeemed voucher and keeps its status", () => {
    expect(
      decide(voucher({ status: "redeemed", reversal: chargebackReversal }), won),
    ).toEqual({ reversal: undefined });
  });

  test("clears the reversal on an expired voucher and keeps its status", () => {
    expect(
      decide(
        voucher({
          status: "expired",
          expiresAt: past,
          reversal: chargebackReversal,
        }),
        won,
      ),
    ).toEqual({ reversal: undefined });
  });

  test("never reverts a reversal that was not caused by a chargeback", () => {
    for (const reason of ["refunded", "cancelled", "legacy-reason"]) {
      expect(
        decide(
          voucher({ status: "refunded", reversal: { reason, notedAt: 1 } }),
          won,
        ),
      ).toBeNull();
    }
  });
});

describe("refunded and cancelled", () => {
  test.each(["refunded", "cancelled"])(
    "%s turns a valid voucher into refunded",
    (status) => {
      expect(decide(voucher(), { status, statusDetail: "refunded" })).toEqual({
        status: "refunded",
        reversal: { reason: status, notedAt: now },
      });
    },
  );

  test.each(["refunded", "cancelled"])(
    "%s records a reversal on redeemed and expired vouchers",
    (status) => {
      for (const state of [
        voucher({ status: "redeemed" }),
        voucher({ status: "expired", expiresAt: past }),
      ]) {
        expect(decide(state, { status })).toEqual({
          reversal: { reason: status, notedAt: now },
        });
      }
    },
  );

  test("never reverts, even when a chargeback is later reported as won", () => {
    const refunded = voucher({
      status: "refunded",
      reversal: { reason: "refunded", notedAt: 1 },
    });
    expect(decide(refunded, { status: "refunded" })).toBeNull();
    expect(
      decide(refunded, { status: "charged_back", chargebackOutcome: "won" }),
    ).toBeNull();
  });

  test("makes a chargeback-caused reversal permanent", () => {
    expect(
      decide(voucher({ status: "refunded", reversal: chargebackReversal }), {
        status: "refunded",
      }),
    ).toEqual({ reversal: { reason: "refunded", notedAt: 1 } });
  });

  test("does not overwrite an earlier permanent reason", () => {
    expect(
      decide(
        voucher({
          status: "redeemed",
          reversal: { reason: "refunded", notedAt: 1 },
        }),
        { status: "cancelled" },
      ),
    ).toBeNull();
  });
});

test("vouchers that never became paid are not affected", () => {
  for (const status of ["pending", "cancelled"] as const) {
    expect(decide(voucher({ status }), { status: "refunded" })).toBeNull();
  }
});
