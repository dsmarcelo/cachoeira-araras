import { HydrateClient } from "@/trpc/server";
import VoucherForm from "./_components/voucher-form";
import Image from "next/image";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-[#17609c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <div className='flex flex-col transform -translate-x-4'>
            <Image src="/logo_cda.png" alt="logo" className='' width={200} height={200} />
          </div>
          <VoucherForm />
        </div>
      </main>
    </HydrateClient>
  );
}
