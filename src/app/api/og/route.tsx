import { ImageResponse } from 'next/og';
import { truncateName } from '@/lib/utils'
import { formatPhone } from '@/lib/utils'
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

const interMedium = fetch(
  new URL("../../../../assets/fonts/Inter-Medium.ttf", import.meta.url)
).then((res) => res.arrayBuffer());
const interRegular = fetch(
  new URL("../../../../assets/fonts/Inter-Regular.ttf", import.meta.url)
).then((res) => res.arrayBuffer());
const interBold = fetch(
  new URL("../../../../assets/fonts/Inter-Bold.ttf", import.meta.url)
).then((res) => res.arrayBuffer());
const interSemiBold = fetch(
  new URL("../../../../assets/fonts/Inter-SemiBold.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

function formatVoucherStatus(status: string, expiration_date: string) {
  if (!status) return <p className="text-red-500">Voucher inválido</p>;
  switch (status) {
    case "pending":
      return <span className="text-yellow-700 w-fit bg-yellow-200/30 rounded-lg px-1 pb-1">Aguardando pagamento</span>
    case "valid":
      return <span style={{
        color: '#10b981',
        // backgroundColor: 'rgba(199, 232, 204, 0.3)',
        borderRadius: '0.375rem',
        // padding: '0 1px 1px'
      }}>Valido até: {expiration_date}</span>;
    case "redeemed":
      return <span className="text-red-500 w-fit bg-red-200/30 rounded-lg px-1 pb-1">Voucher já resgatado</span>;
    case "expired":
      return <span className="text-slate-500 w-fit bg-slate-200/30 rounded-lg px-1 pb-1">Voucher expirado</span>;
    default:
      return <span className="text-red-500 w-fit bg-red-200/30 rounded-lg px-1 pb-1">Voucher inválido</span>;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const { name, phone, adults, elderly, status, expires_at, code } = Object.fromEntries(searchParams.entries());

  if (!name || !phone || !adults || !elderly || !status || !code) {
    return new Response('Voucher not found', { status: 404 });
  }
  const interMediumFontData = await interMedium;
  const interRegularFontData = await interRegular;
  const interBoldFontData = await interBold;
  const interSemiBoldFontData = await interSemiBold;

  function formatQuantity({ adults, elderly }: { adults: number; elderly: number; }): string {
    const adultsText = adults === 1 ? '1 inteira' : `${adults} inteiras`;
    const elderlyText = elderly === 1 ? '1 meia' : `${elderly} meias`;

    if (adults > 0 && elderly > 0) {
      return `${adultsText} e ${elderlyText}`;
    } else if (adults > 0) {
      return adultsText;
    } else if (elderly > 0) {
      return elderlyText;
    } else {
      return 'Nenhuma entrada';
    }
  }

  const formatedName = truncateName(name);
  const formatedPhone = formatPhone(phone);
  const formatedQuantity = formatQuantity({ adults: parseInt(adults), elderly: parseInt(elderly) });
  const expiration_date = expires_at ? expires_at : '';
  const formatedStatus = formatVoucherStatus(status, expiration_date);

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
          backgroundImage: `url(http://localhost:3000/voucher_card.jpg)`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          fontSize: 32,
          fontWeight: 900,
        }}
      >
        <div tw='flex relative' style={{ color: '#00182D' }}>
          <div tw='flex text-[68px] absolute top-46 left-16 flex-col tracking-tight font-semibold' style={{ gap: '30px' }}>
            <div tw='flex font-semibold'>{formatedName}</div>
            <div tw='flex font-semibold'>{formatedPhone}</div>
            <div tw='flex font-semibold'>{formatedQuantity}</div>
            <div tw='flex font-semibold'>{formatedStatus}</div>
          </div>
          <div tw='flex absolute text-[90px] font-bold bottom-16 left-[1175px]'>{code}</div>
        </div>
      </div>
    ),
    {
      width: 1500,
      height: 750,
      status: 200,
      fonts: [
        {
          name: "Inter",
          data: interMediumFontData,
          weight: 500,
        },
        {
          name: "Inter",
          data: interRegularFontData,
          weight: 400,
        },
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
