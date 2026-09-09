// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import RefundNoticeBanner from "./refund-notice-banner";

const mocks = vi.hoisted(() => ({ notices: [] as unknown[] }));

vi.mock("convex/react", () => ({ useQuery: () => mocks.notices }));
vi.mock("./saved-vouchers-provider", () => ({
  useSavedVouchers: () => ({
    ready: true,
    vouchers: [
      {
        code: "ABC123",
        managementToken: "management-token",
        initPoint: "https://example.com",
        createdAt: 1,
      },
    ],
  }),
}));

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("renders refund progress and only lets the confirmed notice be dismissed", async () => {
  const user = userEvent.setup();
  mocks.notices = [
    {
      refundId: "pending-refund",
      voucherCode: "ABC123",
      status: "processing",
      isPostCancellation: true,
      message: "Reembolso em processamento.",
      isDismissible: false,
      updatedAt: 1,
    },
    {
      refundId: "completed-refund",
      voucherCode: "ABC123",
      status: "completed",
      isPostCancellation: true,
      message: "Reembolso confirmado.",
      isDismissible: true,
      completedAt: 2,
      updatedAt: 2,
    },
  ];

  render(<RefundNoticeBanner />);

  expect(screen.getByText("Reembolso em processamento.")).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: "Dispensar aviso" }),
  ).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Dispensar aviso" }));
  expect(screen.queryByText("Reembolso confirmado.")).toBeNull();
  expect(screen.getByText("Reembolso em processamento.")).toBeTruthy();
});
