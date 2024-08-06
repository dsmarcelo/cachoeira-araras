import { ImageResponse } from 'next/og';
import { formateDateDayMonthYear, truncateName } from '@/lib/utils'
import { formatPhone } from '@/lib/utils'
import { type Voucher } from '@prisma/client'
import { type NextRequest } from 'next/server';

// App router includes @vercel/og.
// No need to install it.
export const runtime = 'edge';

export function formatVoucherStatus(status: string, expiration_date: string) {
  if (!status) return <p className="text-red-500">Voucher inválido</p>;
  switch (status) {
    case "pending":
      return <span className="text-yellow-700 w-fit bg-yellow-200/30 rounded-lg px-1 pb-1">Aguardando pagamento</span>
    case "valid":
      return <span style={{
        color: '#10b981',
        backgroundColor: 'rgba(199, 232, 204, 0.3)',
        borderRadius: '0.375rem',
        padding: '0 1px 1px'
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
  console.log('🚀 ~ GET ~ request.nextUrl:', searchParams.get('name'));
  // const queries = Object.fromEntries(searchParams.entries());
  const { name, phone, adults, elderly, status, expires_at, code } = Object.fromEntries(searchParams.entries());
  if (!name || !phone || !adults || !elderly || !status || !code) return new Response('Voucher not found', { status: 404 });
  // const { name } = Object.fromEntries(searchParams.entries());
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
  const expiration_date = expires_at ? formateDateDayMonthYear(expires_at) : '-';
  console.log('🚀 ~ GET ~ expiration_date:', expiration_date);
  const formatedStatus = formatVoucherStatus(status, expiration_date);

  // const { name, phone, adults, elderly, status, expires_at, code } = searchParams;
  // const { name } = searchParams;

  //console.log the fullurl

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
          backgroundImage: `url(http://localhost:3000/voucher_card.png)`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          fontSize: 32,
          fontWeight: 900,
        }}
      >
        <div tw='flex font-bold' style={{ color: 'black', fontWeight: 900 }}>
          <div tw='flex text-5xl absolute top-40 left-20 flex-col tracking-tight font-bold' style={{ gap: '4px' }}>
            <div tw='flex' style={{ fontWeight: 900 }}>{formatedName}</div>
            <div tw='flex font-bold'>{formatedPhone}</div>
            <div tw='flex font-bold'>{formatedQuantity}</div>
            <div tw='flex font-bold'>{formatedStatus}</div>
            {/* <span>{formatVoucherStatus(status)}</span> */}
          </div>
        </div>
      </div>
    ),
    {
      width: 1500,
      height: 750,
      status: 200,
    },
  );
}

{/* <p>{formatQuantity({ adults: adults, elderly: elderly })}</p> */ }
{/* {status !== 'valid' ? <p tw='w-fit'>{formatVoucherStatus(status)}</p> */ }
{/* : <span>Valido até: {expires_at ? formateDateDayMonthYear(expires_at) : 'Não informado'}</span> */ }
{/* } */ }

{/* <h3 tw='relative -bottom-[42px] left-[144px] text-2xl font-bold text-center'>{code}</h3> */ }
{/* <h3 tw='absolute w-fit bottom-0 right-0 mr-[26px] mb-[18px] text-2xl font-bold text-center'>{code}</h3> */ }

{/* <div tw="bg-gray-50 flex">
          <div tw="flex flex-col md:flex-row w-full py-12 px-4 md:items-center justify-between p-8">
            <h2 tw="flex flex-col text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 text-left">
              <span>{name}</span>
              <span tw="text-indigo-600">{phone}</span>
            </h2>
            <div tw="mt-8 flex md:mt-0">
              <div tw="flex rounded-md shadow">
                <a
                  href="#"
                  tw="flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-5 py-3 text-base font-medium text-white"
                >
                  Get started
                </a>
              </div>
              <div tw="ml-3 flex rounded-md shadow">
                <a
                  href="#"
                  tw="flex items-center justify-center rounded-md border border-transparent bg-white px-5 py-3 text-base font-medium text-indigo-600"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
        </div> */}