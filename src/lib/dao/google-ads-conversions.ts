import "server-only";

import { db } from "@/server/db";

export interface VoucherGoogleAdsConversion {
  voucherCode: string;
  gclid: string | null;
  googleAdsConversionUploadedAt: Date | null;
}

export async function findVoucherGoogleAdsConversion(
  voucherCode: string,
): Promise<VoucherGoogleAdsConversion | null> {
  const voucher = await db.voucher.findFirst({
    where: {
      code: voucherCode,
      deletedAt: null,
    },
    select: {
      code: true,
      gclid: true,
      google_ads_conversion_uploaded_at: true,
    },
  });

  if (!voucher) {
    return null;
  }

  return {
    voucherCode: voucher.code,
    gclid: voucher.gclid,
    googleAdsConversionUploadedAt: voucher.google_ads_conversion_uploaded_at,
  };
}

export async function markGoogleAdsConversionUploaded(
  voucherCode: string,
): Promise<boolean> {
  const result = await db.voucher.updateMany({
    where: {
      code: voucherCode,
      google_ads_conversion_uploaded_at: null,
    },
    data: {
      google_ads_conversion_uploaded_at: new Date(),
    },
  });

  return result.count > 0;
}
