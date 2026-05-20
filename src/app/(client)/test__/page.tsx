import VoucherBuyTest from "../../_components/voucher-buy-test";
import InfoCard from "../../_components/info";
import { ImageCarousel } from "../../_components/image_carousel";
import Link from "next/link";
import { RiGalleryView2 } from "react-icons/ri";
import { FaLocationArrow } from "react-icons/fa";
import { MiniImageCarousel } from "../../_components/swiper-carousel/mini-image-carousel";
import { requireStaff } from "@/app/lib";
import { redirect } from "next/navigation";

export default async function TestPage() {
  const user = await requireStaff();

  if (!user) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg-blue text-primary-200 lg:pt-8">
      <ImageCarousel />
      <main className="z-10 -mt-6 flex flex-col items-center gap-12 px-4 pb-8 md:gap-24 md:px-8 md:py-8 lg:mt-0">
        <div className="flex w-full max-w-5xl flex-col justify-center gap-6 lg:flex-row">
          <VoucherBuyTest />
          <InfoCard />
        </div>
        <section className="flex w-full flex-col items-center space-y-4">
          <h4 className="text-center text-3xl font-semibold">
            Veja o que você pode aproveitar
          </h4>
          <MiniImageCarousel />
          <Link
            href="/galeria"
            className="flex h-16 w-full max-w-[500px] items-center justify-center rounded-xl bg-primary-500 font-medium text-bg-blue hover:bg-primary-600"
          >
            <RiGalleryView2 className="mr-2 h-5 w-5" />
            <h4 className="-translate-y-px text-xl">Galeria</h4>
          </Link>
        </section>
        <div className="grid w-full items-center gap-4 text-center md:grid-cols-2 md:gap-8 md:text-right">
          <div className="mx-auto space-y-2">
            <div className="text-xl font-medium">
              GO 338 - Km 18 - Zona Rural / Pirenópolis-GO
            </div>
            <Link
              className="flex h-12 max-w-[500px] items-center justify-center rounded-full bg-primary-500 font-medium text-bg-blue hover:bg-primary-600"
              href="https://maps.app.goo.gl/8pCVbnzQNrpb7D7L8"
              target="_blank"
            >
              <span className="mr-2">
                <FaLocationArrow />
              </span>
              Localização
            </Link>
          </div>
          <div className="flex w-full flex-col items-center justify-center">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d15361.553819846727!2d-49.0319204!3d-15.7305765!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935c5d7f7e549cc1%3A0x1f15768a4f2c4d36!2sCachoeira%20das%20Araras!5e0!3m2!1sen!2sbr!4v1721700001876!5m2!1sen!2sbr"
              width="600"
              height="450"
              className="h-64 w-full rounded-xl border border-slate-300 md:h-96"
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
        </div>
      </main>
    </div>
  );
}
