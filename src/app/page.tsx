import { HydrateClient } from "@/trpc/server";
import Image from "next/image";
import VoucherBuy from "./_components/voucher-buy";
import InfoCard from "./_components/info";
import { ImageCarousel } from "./_components/image_carousel";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center bg-bg-blue text-primary-200">
        <ImageCarousel />
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-4 md:py-8">
          <VoucherBuy />
          <InfoCard />
          <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d15361.553819846727!2d-49.0319204!3d-15.7305765!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935c5d7f7e549cc1%3A0x1f15768a4f2c4d36!2sCachoeira%20das%20Araras!5e0!3m2!1sen!2sbr!4v1721700001876!5m2!1sen!2sbr" width="600" height="450" className="border-0 w-full h-64 md:h-96 max-w-2xl rounded-xl" allowFullScreen={true} loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </main>
    </HydrateClient>
  );
}
