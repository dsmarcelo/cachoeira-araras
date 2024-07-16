import { HydrateClient } from "@/trpc/server";
import VoucherForm from "./_components/voucher-form";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-[#17609c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl text-center font-extrabold tracking-tight sm:text-[5rem]">
            Cachoeira das Araras
          </h1>
          <VoucherForm />
        </div>
      </main>
    </HydrateClient>
  );
}
