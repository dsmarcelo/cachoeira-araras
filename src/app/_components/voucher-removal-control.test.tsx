// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./delete-voucher-cookie-btn", () => ({
  default: ({ code }: { code: string }) => <button>Remover {code}</button>,
}));

import VoucherRemovalControl from "./voucher-removal-control";

afterEach(cleanup);

it("blocks the removal action while a refund is incomplete", () => {
  render(<VoucherRemovalControl code="ABC123" hasIncompleteRefund={true} />);

  expect(screen.getByText(/não pode ser removido/i)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
