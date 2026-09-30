// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PaymentStatus from "./payment-status";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  resume: vi.fn(),
  push: vi.fn(),
  voucher: undefined as object | null | undefined,
  saved: [] as Array<{ code: string; managementToken?: string }>,
}));

vi.mock("convex/react", () => ({
  useConvex: () => ({ mutation: mocks.authorize }),
  useQuery: () => mocks.voucher,
  useMutation: () => mocks.resume,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/app/lib", () => ({ getCookieVoucher: async () => null }));
vi.mock("@/app/_components/saved-vouchers-provider", () => ({
  useSavedVouchers: () => ({
    vouchers: mocks.saved,
    ready: true,
    save: () => true,
    touchEvent: () => undefined,
  }),
}));

const pendingVoucher = {
  code: "BRICK1",
  status: "pending",
  createdAt: 1,
};

// The lookup capability is cached per code for the tab, so a test that needs
// a fresh lookup uses its own code.
async function renderStatus(code = "BRICK1") {
  render(<PaymentStatus code={code} />);
  await act(() => Promise.resolve());
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.voucher = undefined;
  mocks.saved = [];
  mocks.authorize.mockResolvedValue({
    kind: "authorized",
    lookupToken: "lookup-1",
  });
});
afterEach(cleanup);

describe("PaymentStatus", () => {
  it("does not present a failed lookup as a missing voucher, and can retry", async () => {
    const user = userEvent.setup();
    mocks.authorize.mockRejectedValueOnce(new Error("Failed to fetch"));
    await renderStatus("OFFLINE1");

    expect(screen.getByText("Não foi possível consultar agora")).toBeTruthy();
    expect(screen.queryByText("Voucher não encontrado")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(mocks.authorize).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Não foi possível consultar agora")).toBeNull();
  });

  it("tells a voucher that really does not exist apart from a failed lookup", async () => {
    mocks.authorize.mockResolvedValue({ kind: "not_found" });
    await renderStatus("MISSING1");

    expect(screen.getByText("Voucher não encontrado")).toBeTruthy();
  });

  it("continues a pending purchase where the server says it can continue", async () => {
    const user = userEvent.setup();
    mocks.voucher = pendingVoucher;
    mocks.saved = [{ code: "BRICK1", managementToken: "token-1" }];
    mocks.resume.mockResolvedValue({
      kind: "resumed",
      code: "BRICK1",
      checkoutUrl: "/pagar/BRICK1",
    });
    await renderStatus();

    await user.click(
      screen.getByRole("button", { name: "Continuar o pagamento" }),
    );

    expect(mocks.resume).toHaveBeenCalledWith({
      code: "BRICK1",
      managementToken: "token-1",
    });
    expect(mocks.push).toHaveBeenCalledWith("/pagar/BRICK1");
  });

  it("without the browser's authorization points to the original browser and support", async () => {
    mocks.voucher = pendingVoucher;
    await renderStatus();

    expect(screen.queryByRole("button", { name: "Continuar o pagamento" })).toBeNull();
    expect(screen.getByText(/navegador onde ela foi iniciada/)).toBeTruthy();
    expect(screen.getByText(/nossa equipe/)).toBeTruthy();
  });

  it("explains why a purchase that ended cannot be continued", async () => {
    const user = userEvent.setup();
    mocks.voucher = pendingVoucher;
    mocks.saved = [{ code: "BRICK1", managementToken: "token-1" }];
    mocks.resume.mockResolvedValue({
      kind: "terminal",
      status: "cancelling",
      message: "Esta compra está em processo de cancelamento e não pode ser paga.",
    });
    await renderStatus();

    await user.click(
      screen.getByRole("button", { name: "Continuar o pagamento" }),
    );

    expect(screen.getByRole("alert").textContent).toMatch(/cancelamento/);
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
