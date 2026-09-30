// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResumePayment } from "./use-resume-payment";

const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  push: vi.fn(),
  assign: vi.fn(),
}));

vi.mock("convex/react", () => ({ useMutation: () => mocks.resume }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

const args = { code: "BRICK1", managementToken: "token-1" };

async function resume() {
  const { result } = renderHook(() => useResumePayment());
  let message: string | null = "unset";
  await act(async () => {
    message = await result.current(args);
  });
  return message;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("location", { assign: mocks.assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useResumePayment", () => {
  it("opens the internal checkout of an embedded purchase in the app", async () => {
    mocks.resume.mockResolvedValue({
      kind: "resumed",
      code: "BRICK1",
      checkoutUrl: "/pagar/BRICK1",
    });

    expect(await resume()).toBeNull();
    expect(mocks.push).toHaveBeenCalledWith("/pagar/BRICK1");
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("leaves the site only for a verified Checkout Pro address", async () => {
    mocks.resume.mockResolvedValue({
      kind: "resumed",
      code: "PRO001",
      checkoutUrl: "https://www.mercadopago.com.br/checkout/PRO001",
    });

    expect(await resume()).toBeNull();
    expect(mocks.assign).toHaveBeenCalledWith(
      "https://www.mercadopago.com.br/checkout/PRO001",
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("takes an already paid purchase to its receipt", async () => {
    mocks.resume.mockResolvedValue({
      kind: "already_paid",
      code: "BRICK1",
      redirectUrl: "/pagamento?external_reference=BRICK1",
    });

    expect(await resume()).toBeNull();
    expect(mocks.push).toHaveBeenCalledWith(
      "/pagamento?external_reference=BRICK1",
    );
  });

  it("explains an ended purchase instead of offering payment", async () => {
    mocks.resume.mockResolvedValue({
      kind: "terminal",
      status: "cancelled",
      message: "Esta compra foi cancelada e não pode mais ser paga.",
    });

    expect(await resume()).toBe(
      "Esta compra foi cancelada e não pode mais ser paga.",
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.assign).not.toHaveBeenCalled();
  });

  it("keeps not found and not authorized apart from a connection failure", async () => {
    mocks.resume.mockRejectedValueOnce(new ConvexError("Voucher não encontrado."));
    expect(await resume()).toBe("Voucher não encontrado.");

    mocks.resume.mockRejectedValueOnce(
      new ConvexError("Não autorizado. A retomada só vale no navegador original."),
    );
    expect(await resume()).toMatch(/Não autorizado/);

    mocks.resume.mockRejectedValueOnce(new Error("Failed to fetch"));
    const message = await resume();
    expect(message).toMatch(/conexão/);
    expect(message).not.toMatch(/não encontrad/i);
  });
});
