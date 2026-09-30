import type { Voucher } from "@prisma/client";

export function pendingVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: 1,
    code: "a1b2",
    name: "Cliente",
    phone: "11999999999",
    adults: 1,
    elderly: 0,
    adults_pool: 0,
    elderly_pool: 0,
    price: 50,
    preference_id: "preference-1",
    payment_id: "123",
    status: "pending",
    valid: false,
    expires_at: new Date("2099-01-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}
