import { MainCarouselGallery } from "@/components/ui/carousel";
import { getMainCarouselImages } from "@/lib/dao/main-carousel-images";

export async function ImageCarousel() {
  const images = getMainCarouselImages();

  return <MainCarouselGallery images={images} />;
}
