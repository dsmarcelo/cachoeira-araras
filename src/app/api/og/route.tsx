import { ImageResponse } from 'next/og';
import { formatPhone } from '@/lib/utils'
import { type NextRequest } from 'next/server';
import { formatQuantity, formatVoucherStatusWithoutBg } from '@/lib/voucher';

export const runtime = 'edge';

const interBold = fetch(
  new URL("../../../../assets/fonts/Inter-Bold.ttf", import.meta.url)
).then((res) => res.arrayBuffer());
const interSemiBold = fetch(
  new URL("../../../../assets/fonts/Inter-SemiBold.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const { name, phone, quantity, status, expires_at, code } = Object.fromEntries(searchParams.entries());

  if (!name || !phone || !quantity || !status || !code) {
    return new Response('Voucher not found', { status: 404 });
  }

  const interBoldFontData = await interBold;
  const interSemiBoldFontData = await interSemiBold;

  const expiration_date = expires_at ? expires_at : '';
  const formatedStatus = formatVoucherStatusWithoutBg(status, expiration_date);

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
          backgroundImage: `url(http://localhost:3000/voucher_card_w_750px.jpg)`,
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
            <div tw='flex font-semibold'>{quantity}</div>
            <div tw='flex font-semibold'>{formatedStatus}</div>
          </div>
          <div tw='flex absolute text-[48px] font-bold bottom-8 left-[585px]'>{code}</div>
        </div>
      </div>
    ),
    {
      width: 750,
      height: 375,
      status: 200,
      fonts: [
        {
          name: "Inter",
          data: interBoldFontData,
          weight: 700,
        },
        {
          name: "Inter",
          data: interSemiBoldFontData,
          weight: 600,
        },
      ],
    },
  );
}
