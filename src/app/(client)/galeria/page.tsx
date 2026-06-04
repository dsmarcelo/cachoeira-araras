import ImageGallery from "../../_components/galery";
import { MobileHomeButton } from "../../_components/mobile-home-button";
import { getGalleryImages } from "@/lib/dao/gallery-images";

export default async function page() {
  const images = getGalleryImages();

  return (
    <div className="relative mb-auto w-full justify-center pb-4">
      <div className="mx-auto mb-4 flex w-full items-center justify-center rounded-b-xl bg-dark-blue pb-2 md:mb-8 md:rounded-b-3xl">
        <h1 className="text-xl font-bold text-primary-50 md:text-3xl">
          Galeria de Fotos
        </h1>
      </div>
      <ImageGallery images={images} />
      <MobileHomeButton />
    </div>
  );
}
