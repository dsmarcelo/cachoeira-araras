// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PendingPurchaseDialog from "./pending-purchase-dialog";

const mocks = vi.hoisted(() => ({
  conflict: {} as unknown,
  cancel: vi.fn(),
  resume: vi.fn(),
  push: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.conflict,
  useMutation: () => mocks.resume,
  useAction: () => mocks.cancel,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("PendingPurchaseDialog", () => {
  it("does not reveal voucher or financial details without a capability", () => {
    mocks.conflict = { kind: "generic", message: "generic" };

    render(
      <PendingPurchaseDialog
        open
        onOpenChange={() => undefined}
        phone="11999999999"
        managementTokens={[]}
      />,
    );

    expect(screen.getByText("Compra pendente encontrada")).toBeTruthy();
    expect(screen.getByText(/navegador onde ela foi iniciada/i)).toBeTruthy();
    expect(screen.queryByText(/Código:/i)).toBeNull();
    expect(screen.queryByText(/Valor/i)).toBeNull();
  });

  it("requires confirmation before cancelling an authorized purchase", async () => {
    const user = userEvent.setup();
    mocks.conflict = {
      kind: "authorized",
      vouchers: [
        {
          code: "ABC123",
          visitDate: "2026-09-10",
          adults: 2,
          elderly: 0,
          adultsPool: 0,
          elderlyPool: 0,
          priceCents: 10000,
          status: "pending",
          actions: { canCancel: true, canResume: true },
        },
      ],
    };

    render(
      <PendingPurchaseDialog
        open
        onOpenChange={() => undefined}
        phone="11999999999"
        managementTokens={["management-token"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancelar compra" }));
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(screen.getByText(/Deseja realmente cancelar/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Confirmar cancelamento" }),
    ).toBeTruthy();
  });
});
