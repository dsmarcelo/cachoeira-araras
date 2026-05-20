import { env } from '@/env';
import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { formatVoucherStatusWithoutBg } from '@/lib/voucher';

// Switch OG generation to node runtime to avoid Edge invocations on Vercel Free
export const runtime = 'nodejs';

// Read font from disk directly in Node runtime to avoid fetch-ing a relative URL
const interSemiBold = fs
  .readFile(path.join(process.cwd(), 'assets', 'fonts', 'Inter-SemiBold.ttf'))
  .then((buf) => buf);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const { name, phone, quantity, price, status, expires_at, code } = Object.fromEntries(searchParams.entries());

  if (!name || !phone || !quantity || !status || !code) {
    return new Response('Voucher not found', { status: 404 });
  }

  const interSemiBoldFontData = await interSemiBold;

  const expiration_date = expires_at ?? '';
  const formatedStatus = formatVoucherStatusWithoutBg(status, expiration_date);

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
            <div tw='flex font-semibold'>{name}</div>
            <div tw='flex font-semibold'>{phone}</div>
            <div tw='flex font-semibold text-[28px] backdrop-blur-md bg-[#fdd56c] rounded-lg p-2'>{quantity}</div>
            <div tw='flex font-semibold'>{formatedStatus}</div>
          </div>
          <div tw='flex absolute bottom-6 left-[300px]'>Valor: R$ { Number(price).toFixed(2).replace('.', ',')}</div>
          <div tw='flex absolute text-[48px] font-semibold bottom-8 left-[585px]'>{code}</div>
        </div>
      </div>
    ),
    {
      width: 750,
      height: 375,
      status: 200,
      // Aggressive caching to avoid repeated invocations for the same query params
      headers: {
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
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
