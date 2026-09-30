// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EmbeddedCheckout } from "./embedded-checkout";

type BrickProps = {
  onSubmit: (data: {
    formData: { payment_method_id: string; payer: { email: string } };
  }) => Promise<unknown>;
  onReady?: () => void;
  onError?: (error: { type: string; message: string }) => void;
};

const mocks = vi.hoisted(() => ({
  checkout: undefined as object | undefined,
  vouchers: [] as Array<{ code: string; managementToken?: string }>,
  submit: vi.fn(),
  reconcile: vi.fn(),
  replace: vi.fn(),
  brick: { current: null as null | BrickProps },
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.checkout,
  useAction: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref).endsWith("submitPixPayment")
      ? mocks.submit
      : mocks.reconcile,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/app/_components/saved-vouchers-provider", () => ({
  useSavedVouchers: () => ({ vouchers: mocks.vouchers, ready: true }),
}));
vi.mock("@/lib/sentry/payment", () => ({
  capturePaymentFlowException: vi.fn(),
}));
vi.mock("@mercadopago/sdk-react", () => ({
  initMercadoPago: vi.fn(),
  Payment: (props: BrickProps) => {
    mocks.brick.current = props;
    return (
      <button type="button" onClick={() => props.onReady?.()}>
        brick-ready
      </button>
    );
  },
}));

const EXPIRES_AT = Date.parse("2026-09-30T13:30:00Z");

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    kind: "ok",
    voucher: {
      code: "BRICK1",
      name: "Maria Souza",
      status: "pending",
      visitDate: "2026-10-05",
      adults: 2,
      elderly: 0,
      adultsPool: 0,
      elderlyPool: 0,
      priceCents: 14000,
      cancelling: false,
    },
    embedded: true,
    pixCutoffAt: null,
    attempt: null,
    ...overrides,
  };
}

const pixAttempt = {
  status: "pending",
  method: "pix",
  createdAt: EXPIRES_AT - 30 * 60_000,
  expiresAt: EXPIRES_AT,
  pix: { qrCode: "000201pixcopiaecola", qrCodeBase64: "iVBORw0KGgo=" },
};

function renderPage() {
  return render(<EmbeddedCheckout code="BRICK1" publicKey="TEST-key" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(EXPIRES_AT - 20 * 60_000);
  mocks.vouchers = [{ code: "BRICK1", managementToken: "token-1" }];
  mocks.checkout = checkout();
  mocks.reconcile.mockResolvedValue("checked");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("EmbeddedCheckout", () => {
  it("shows the purchase summary and a loading state until the payment form is ready", () => {
    renderPage();

    expect(screen.getByText("Maria Souza")).toBeTruthy();
    expect(screen.getByText(/05\/10\/2026/)).toBeTruthy();
    expect(screen.getByText(/2 inteiras/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*140,00/)).toBeTruthy();
    expect(screen.getByText(/Carregando o formulário de pagamento/)).toBeTruthy();
  });

  it("offers recovery without losing the purchase when the payment form fails to load", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    act(() => mocks.brick.current?.onError?.({ type: "critical", message: "x" }));

    expect(screen.getByRole("alert").textContent).toMatch(
      /Não foi possível carregar o formulário de pagamento/,
    );
    expect(screen.getByText("Maria Souza")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends only the request identity, method and payer to the server", async () => {
    mocks.submit.mockResolvedValue({ status: "pending" });
    renderPage();

    await act(() =>
      mocks.brick.current!.onSubmit({
        formData: { payment_method_id: "pix", payer: { email: "m@example.com" } },
      }),
    );

    expect(mocks.submit).toHaveBeenCalledTimes(1);
    const sent = mocks.submit.mock.calls[0]![0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      code: "BRICK1",
      managementToken: "token-1",
      paymentMethodId: "pix",
      payer: { email: "m@example.com" },
    });
    expect(JSON.stringify(sent)).not.toMatch(/amount|price/i);
  });

  it("reuses the request identity on a resend and starts a new one after a refusal", async () => {
    mocks.submit
      .mockResolvedValueOnce({ status: "uncertain" })
      .mockResolvedValueOnce({ status: "rejected", message: "Confira seus dados." })
      .mockResolvedValueOnce({ status: "pending" });
    renderPage();
    const submit = () =>
      act(() =>
        mocks.brick.current!.onSubmit({
          formData: { payment_method_id: "pix", payer: { email: "m@example.com" } },
        }).catch(() => undefined),
      );

    await submit();
    await submit();
    await submit();

    const ids = mocks.submit.mock.calls.map(
      (call) => (call[0] as { requestId: string }).requestId,
    );
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[1]);
  });

  it("shows a readable message when the server refuses the charge", async () => {
    mocks.submit.mockRejectedValue(
      new ConvexError("Você já tem um pagamento em andamento para esta compra."),
    );
    renderPage();

    await act(() =>
      mocks.brick.current!
        .onSubmit({
          formData: { payment_method_id: "pix", payer: { email: "m@example.com" } },
        })
        .catch(() => undefined),
    );

    expect(screen.getByRole("alert").textContent).toMatch(/em andamento/);
  });

  describe("with a pending Pix", () => {
    beforeEach(() => {
      mocks.checkout = checkout({ attempt: pixAttempt });
    });

    it("presents the QR code, the copyable code and the deadline instead of the form", () => {
      renderPage();

      expect(screen.getByAltText(/QR Code do Pix/).getAttribute("src")).toContain(
        "iVBORw0KGgo=",
      );
      expect(screen.getByDisplayValue("000201pixcopiaecola")).toBeTruthy();
      expect(screen.getByText(/10:30/)).toBeTruthy();
      expect(screen.queryByText("brick-ready")).toBeNull();
    });

    it("confirms when the code was copied", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const writeText = vi.fn().mockResolvedValue(undefined);
      // Installed after `setup`, which replaces the clipboard with its own stub.
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });
      renderPage();

      await user.click(screen.getByRole("button", { name: /Copiar código/ }));

      expect(writeText).toHaveBeenCalledWith("000201pixcopiaecola");
      expect(screen.getByText(/Código copiado/)).toBeTruthy();
    });

    it("offers a manual alternative when copying fails", async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
        configurable: true,
      });
      renderPage();

      await user.click(screen.getByRole("button", { name: /Copiar código/ }));

      expect(screen.getByRole("alert").textContent).toMatch(/copie manualmente/);
      expect(screen.getByDisplayValue("000201pixcopiaecola")).toBeTruthy();
    });

    it("stops presenting an expired code as payable, keeping the purchase", () => {
      vi.setSystemTime(EXPIRES_AT + 1000);
      renderPage();

      expect(screen.getByText(/O código Pix venceu/)).toBeTruthy();
      expect(screen.queryByAltText(/QR Code do Pix/)).toBeNull();
      expect(screen.queryByRole("button", { name: /Copiar código/ })).toBeNull();
      expect(screen.getByText("Maria Souza")).toBeTruthy();
    });

    it("keeps checking the payment while the Pix is pending", async () => {
      renderPage();

      await act(() => vi.advanceTimersByTimeAsync(0));

      expect(mocks.reconcile).toHaveBeenCalledWith({
        code: "BRICK1",
        managementToken: "token-1",
      });
    });
  });

  it("asks the buyer to wait, without offering a new charge, while the result is uncertain", () => {
    mocks.checkout = checkout({
      attempt: { ...pixAttempt, status: "uncertain", pix: undefined },
    });
    renderPage();

    expect(screen.getByText(/Estamos verificando o seu pagamento/)).toBeTruthy();
    expect(screen.queryByText("brick-ready")).toBeNull();
  });

  it("checks an uncertain charge on arrival and shows the recovered Pix without a new charge", async () => {
    mocks.checkout = checkout({
      attempt: { ...pixAttempt, status: "uncertain", pix: undefined },
    });
    const view = renderPage();
    await act(() => Promise.resolve());

    expect(mocks.reconcile).toHaveBeenCalledWith({
      code: "BRICK1",
      managementToken: "token-1",
    });
    expect(mocks.submit).not.toHaveBeenCalled();

    mocks.checkout = checkout({ attempt: pixAttempt });
    view.rerender(<EmbeddedCheckout code="BRICK1" publicKey="TEST-key" />);

    expect(screen.getByDisplayValue("000201pixcopiaecola")).toBeTruthy();
  });

  it("says the check failed without treating it as proof of no payment", async () => {
    mocks.reconcile.mockRejectedValue(new Error("offline"));
    mocks.checkout = checkout({
      attempt: { ...pixAttempt, status: "uncertain", pix: undefined },
    });
    renderPage();
    await act(() => Promise.resolve());

    expect(screen.getByText(/Não conseguimos verificar o pagamento agora/)).toBeTruthy();
    expect(screen.getByText(/Estamos verificando o seu pagamento/)).toBeTruthy();
    expect(screen.queryByText("brick-ready")).toBeNull();
  });

  it("explains a slow connection instead of claiming the purchase does not exist", () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    mocks.checkout = undefined;
    renderPage();
    expect(screen.queryByText(/demorando mais que o normal/)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(screen.getByText(/demorando mais que o normal/)).toBeTruthy();
    expect(screen.queryByText(/não encontrada/i)).toBeNull();
  });

  it("explains that a same-day Pix is no longer available after the cutoff", () => {
    mocks.checkout = checkout({ pixCutoffAt: EXPIRES_AT - 30 * 60_000 });
    renderPage();

    expect(screen.getByText(/só pode ser gerado até as 16h30/)).toBeTruthy();
    expect(screen.queryByText("brick-ready")).toBeNull();
  });

  it("sends the buyer to the approved voucher", () => {
    mocks.checkout = checkout({
      voucher: { ...checkout().voucher, status: "valid" },
    });
    renderPage();

    expect(mocks.replace).toHaveBeenCalledWith(
      "/pagamento?external_reference=BRICK1",
    );
  });

  it("guides the buyer when this browser does not hold the purchase", () => {
    mocks.vouchers = [];
    mocks.checkout = undefined;
    renderPage();

    expect(screen.getByText(/navegador onde a compra foi iniciada/)).toBeTruthy();
  });

  it("explains a purchase that can no longer be paid", () => {
    mocks.checkout = checkout({
      voucher: { ...checkout().voucher, status: "cancelled" },
    });
    renderPage();

    expect(screen.getByText(/foi cancelada/)).toBeTruthy();
    expect(screen.queryByText("brick-ready")).toBeNull();
  });
});
