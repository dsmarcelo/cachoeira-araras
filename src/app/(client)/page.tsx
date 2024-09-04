import VoucherBuy from "../_components/voucher-buy";
import InfoCard from "../_components/info";
import { ImageCarousel } from "../_components/image_carousel";
import Link from "next/link";
import { RiGalleryView2 } from "react-icons/ri";
import { FaLocationArrow } from "react-icons/fa";
import { MiniImageCarousel } from "../_components/swiper-carousel/mini-image-carousel";

export default async function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-bg-blue lg:pt-8 text-primary-200">
      <ImageCarousel />
      <main className="flex flex-col items-center px-4 gap-12 md:gap-24 pb-8 z-10 -mt-6 lg:mt-0 md:py-8 md:px-8">
        <div className="w-full max-w-5xl flex flex-col justify-center gap-6 lg:flex-row">
          <VoucherBuy />
          <InfoCard />
        </div>
        <section className="w-full flex flex-col items-center space-y-4">
          <h4 className="font-semibold text-3xl text-center">Veja o que você pode aproveitar</h4>
          <MiniImageCarousel />
          <Link href="/galeria" className="h-16 w-full max-w-[500px] flex justify-center items-center rounded-xl font-medium bg-primary-500 text-bg-blue hover:bg-primary-600">
            <RiGalleryView2 className="mr-2 h-5 w-5" />
            <h4 className="text-xl -translate-y-px">Galeria</h4>
          </Link>
        </section>
        <div className="w-full grid md:grid-cols-2 text-center md:text-right items-center gap-4 md:gap-8">
          <div className="mx-auto space-y-2">
            <div className="font-medium text-xl">
              GO 338 - Km 18 - Zona Rural / Pirenópolis-GO
            </div>
            <Link
              className="h-12 max-w-[500px] flex justify-center items-center rounded-full font-medium bg-primary-500 text-bg-blue hover:bg-primary-600"
              href="https://maps.app.goo.gl/8pCVbnzQNrpb7D7L8" target="_blank">
              <span className="mr-2"><FaLocationArrow /></span>
              Localização
            </Link>
          </div>
          <div className="w-full flex flex-col items-center justify-center">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d15361.553819846727!2d-49.0319204!3d-15.7305765!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935c5d7f7e549cc1%3A0x1f15768a4f2c4d36!2sCachoeira%20das%20Araras!5e0!3m2!1sen!2sbr!4v1721700001876!5m2!1sen!2sbr" width="600" height="450" className="w-full border border-slate-300 h-64 md:h-96 rounded-xl" allowFullScreen={true} loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
          </div>
        </div>
      </main>
    </div>
  );
}
