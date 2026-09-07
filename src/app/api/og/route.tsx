import { env } from '@/env';
import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { formatVoucherStatusWithoutBg, formatQuantity } from '@/lib/voucher';
import { formateDateDayMonthYear, formatPhone, truncateName } from '@/lib/utils';
import { getVoucherImageData } from '@/server/voucher-image-data';

// Switch OG generation to node runtime to avoid Edge invocations on Vercel Free
export const runtime = 'nodejs';

// Read font from disk directly in Node runtime to avoid fetch-ing a relative URL
const interSemiBold = fs
  .readFile(path.join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'))
  .then((buf) => buf);

/**
 * Renders the voucher card image by code, looking up the real record on the
 * server rather than trusting name/phone/price/status from query params —
 * the old contract let anyone forge a voucher-shaped image for any code.
 * Rejects pending or unknown codes, since there is nothing to show yet.
 * Never cached: a resgate, expiração, or estorno must show up immediately.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const lookupToken = request.nextUrl.searchParams.get('lookupToken');

  if (!code || !lookupToken) {
    return new Response('Missing code', { status: 400 });
  }

  const voucher = await getVoucherImageData(code, lookupToken);

  if (!voucher || voucher.status === 'pending') {
    return new Response('Voucher not found', { status: 404 });
  }

  const interSemiBoldFontData = await interSemiBold;

  const formatedExpiredDate = formateDateDayMonthYear(new Date(voucher.expiresAt));
  const formatedStatus = formatVoucherStatusWithoutBg(voucher.status, formatedExpiredDate);
  const formatedName = truncateName(voucher.name);
  const formatedPhone = formatPhone(voucher.phone);
  const formatedQuantity = formatQuantity({
    adults: voucher.adults,
    elderly: voucher.elderly,
    adults_pool: voucher.adultsPool,
    elderly_pool: voucher.elderlyPool,
  });
  const price = voucher.priceCents / 100;

  let url = ''
  if (env.NEXT_PUBLIC_VERCEL_URL) {
    url = `https://${env.NEXT_PUBLIC_VERCEL_URL}`
  } else if (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    url = `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
  } else {
    url = 'http://localhost:3000'
  }


  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          fontFamily: 'Inter',
          backgroundColor: 'black',
          display: 'flex',
          color: 'white',
          backgroundImage: `url(${url}/voucher_card_w_750px.jpg)`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          fontSize: 18,
          fontWeight: 900,
        }}
      >
        <div tw='flex relative' style={{ color: '#00182D' }}>
          <div tw='flex text-[34px] absolute top-22 left-8 flex-col tracking-tight font-semibold' style={{ gap: '14px' }}>
            <div tw='flex font-semibold'>{formatedName}</div>
            <div tw='flex font-semibold'>{formatedPhone}</div>
            <div tw='flex font-semibold text-[28px] backdrop-blur-md bg-[#fdd56c] rounded-lg p-2'>{formatedQuantity}</div>
            <div tw='flex font-semibold'>{formatedStatus}</div>
          </div>
          <div tw='flex absolute bottom-6 left-[300px]'>Valor: R$ { price.toFixed(2).replace('.', ',')}</div>
          <div tw='flex absolute text-[48px] font-semibold bottom-8 left-[585px]'>{voucher.code}</div>
        </div>
      </div>
    ),
    {
      width: 750,
      height: 375,
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
      fonts: [
        {
          name: "Inter",
          data: interSemiBoldFontData,
          weight: 600,
        },
      ],
    },
  );
}
