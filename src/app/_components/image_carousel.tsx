"use client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import Image from "next/image";
import { motion } from "framer-motion";

export function ImageCarousel() {
  const getImages = () => {
    const quantity = 7;
    const images = [];

    for (let i = 0; i < quantity; i++) {
      images.push(`/images/carousel/${i + 1}.jpg`);
    }
    return images;
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
                  <Image
                    src={image}
                    alt="Imagem"
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
