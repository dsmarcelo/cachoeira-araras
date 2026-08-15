import VoucherBuy from "../_components/voucher-buy";
import InfoCard from "../_components/info";
import { ImageCarousel } from "../_components/image_carousel";
import Link from "next/link";
import { RiGalleryView2 } from "react-icons/ri";
import { AttractionCardCarousel } from "../_components/attraction-card-carousel";
import { MapAppButtons } from "../_components/map-app-buttons";

export default async function Home() {
  return (
    <div className="flex min-h-screen min-w-0 flex-col items-center bg-bg-blue lg:pt-8 text-primary-200">
      <ImageCarousel />
      <main className="flex flex-col items-center w-full min-w-0 px-4 gap-12 md:gap-24 pb-8 z-10 -mt-6 lg:mt-0 md:py-8 md:px-8">
        {/* Mobile: voucher → carousel → info → galeria. md+: voucher | info, then attractions + galeria. */}
        <div className="flex w-full max-w-5xl flex-col justify-center gap-6 md:grid md:grid-cols-2">
          <div className="order-1">
            <VoucherBuy />
          </div>
          <section className="order-2 flex w-full flex-col items-center space-y-4 md:order-3 md:col-span-2">
            <h4 className="text-center text-3xl font-semibold">
              Veja o que você pode aproveitar
            </h4>
            <AttractionCardCarousel />
            <Link
              href="/galeria"
              className="hidden h-16 w-full max-w-[500px] items-center justify-center rounded-xl bg-primary-500 font-medium text-bg-blue hover:bg-primary-600 md:flex"
            >
              <RiGalleryView2 className="mr-2 h-5 w-5" />
              <h4 className="-translate-y-px text-xl">Galeria</h4>
            </Link>
          </section>
          <div className="order-3 md:order-2">
            <InfoCard />
          </div>
          <Link
            href="/galeria"
            className="order-4 flex h-16 w-full max-w-[500px] items-center justify-center self-center rounded-xl bg-primary-500 font-medium text-bg-blue hover:bg-primary-600 md:hidden"
          >
            <RiGalleryView2 className="mr-2 h-5 w-5" />
            <h4 className="-translate-y-px text-xl">Galeria</h4>
          </Link>
        </div>
        <div className="w-full grid md:grid-cols-2 text-center md:text-right items-center gap-4 md:gap-8">
          <div className="mx-auto flex flex-col items-center space-y-4">
            <div className="font-medium text-xl">
              GO 338 - Km 18 - Zona Rural / Pirenópolis-GO
            </div>
            <MapAppButtons />
          </div>
          <div className="w-full flex flex-col items-center justify-center">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3197.8051767937786!2d-49.03570865266417!3d-15.733303493238164!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935c5d7f7e549cc1%3A0x1f15768a4f2c4d36!2sCachoeira%20das%20Araras!5e0!3m2!1spt-BR!2sbr!4v1786745501861!5m2!1spt-BR!2sbr" width="600" height="450" className="w-full border border-slate-300 h-64 md:h-96 rounded-xl" allowFullScreen={true} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"></iframe>
          </div>
        </div>
      </main>
    </div>
  );
}
