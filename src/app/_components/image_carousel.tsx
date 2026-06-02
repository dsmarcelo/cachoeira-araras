"use client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { motion } from "framer-motion";

export function ImageCarousel() {
  const getImages = () => {
    return [
      "/images/carousel-1.avif",
      "/images/carousel-2.avif",
      "/images/carousel-3.avif",
      "/images/carousel-4.avif",
      "/images/carousel-5.avif",
      "/images/carousel-6.avif",
      "/images/carousel-7.avif",
    ];
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="mx-auto w-full max-w-5xl overflow-hidden lg:rounded-2xl"
    >
      <div className="mx-auto w-full max-w-5xl overflow-hidden lg:rounded-2xl">
        <Carousel
          opts={{
            loop: true,
          }}
        >
          <CarouselContent>
            {getImages().map((image, index) => (
              <CarouselItem
                key={index}
                className="aspect-[2/1] w-full md:max-tall:aspect-[2.5/1]"
              >
                <div className="relative h-full w-full">
                  <OptimizedImage
                    src={image}
                    alt="Foto da Cachoeira das Araras"
                    fill
                    quality={60}
                    className="object-cover"
                    // Only the initially visible slide is prioritized to keep
                    // carousel image requests data-friendly.
                    priority={index < 1}
                    loading={
                      index < 1 ? ("eager" as const) : ("lazy" as const)
                    }
                    sizes="(max-width: 768px) 100vw, 75vw"
                    // Disable server image optimizer to avoid additional server invocations for static assets
                    unoptimized
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-bg-blue via-transparent via-15% to-transparent lg:hidden"></div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </motion.div>
  );
}
