import { HydrateClient } from "@/trpc/server";
import Image from "next/image";
import VoucherBuy from "./_components/voucher-buy";
import InfoCard from "./_components/info";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-bg-blue text-primary-200">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <div className='flex flex-col transform -translate-x-4'>
            <Image src="/logo_cda.png" alt="logo" className='' width={200} height={200} />
          </div>
          <VoucherBuy />
          <InfoCard />
        </div>
      </main>
    </HydrateClient>
  );
}
