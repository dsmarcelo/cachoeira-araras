import { PrismaClient } from "@prisma/client";

export class VoucherTestDao {
  #db;

  constructor() {
    this.#db = new PrismaClient();
  }

  async createPendingVoucher(data) {
    return await this.#db.voucher.create({
      data: {
        name: data.name,
        phone: data.phone,
        code: data.code,
        adults: data.adults,
        elderly: data.elderly,
        adults_pool: data.adultsPool,
        elderly_pool: data.elderlyPool,
        price: data.price,
        valid: false,
        status: "pending",
        preference_id: data.preferenceId,
        expires_at: data.expiresAt,
      },
    });
  }

  async findVoucherByCode(code) {
    return await this.#db.voucher.findUnique({
      where: { code },
    });
  }

  async confirmVoucherPaymentByPreferenceId(preferenceId, paymentId) {
    const voucher = await this.#db.voucher.findUnique({
      where: { preference_id: preferenceId },
    });

    if (!voucher) {
      throw new Error(`Voucher not found for preference ${preferenceId}`);
    }

    if (voucher.status !== "pending") {
      return voucher;
    }

    return await this.#db.voucher.update({
      where: { preference_id: preferenceId },
      data: {
        status: "valid",
        valid: true,
        payment_id: paymentId,
      },
    });
  }

  async redeemVoucherByCode(code) {
    const voucher = await this.findVoucherByCode(code);

    if (!voucher) {
      throw new Error("Voucher nao encontrado.");
    }

    if (!voucher.valid) {
      throw new Error("Este voucher nao esta disponivel para uso.");
    }

    return await this.#db.voucher.update({
      where: { code },
      data: {
        status: "redeemed",
        valid: false,
      },
    });
  }

  async deleteVoucherByCode(code) {
    await this.#db.referrer.deleteMany({
      where: { voucherCode: code },
    });

    await this.#db.voucher.deleteMany({
      where: { code },
    });
  }

  async disconnect() {
    await this.#db.$disconnect();
  }
}
