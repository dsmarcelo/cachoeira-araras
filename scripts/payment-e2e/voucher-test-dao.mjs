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
