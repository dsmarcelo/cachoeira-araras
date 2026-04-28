"use client";
import * as React from "react";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import Image from "next/image";
import { motion } from "framer-motion";
import { env } from "@/env";

export function ImageCarousel() {
  // Autoplay plugin instance. We disable built-in stop on interaction so we can
  // implement a custom 3s pause on user drag, then resume.
  const autoplay = React.useRef(
    Autoplay({
      delay: 5000,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
    }),
  );
  const fade = React.useRef(Fade());
  const [emblaApi, setEmblaApi] = React.useState<CarouselApi | null>(null);
  const resumeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Attach Embla events to pause on drag and resume after 3s
  React.useEffect(() => {
    if (!emblaApi) return;

    const clearResumeTimeout = () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    };

    const handlePointerDown = () => {
      clearResumeTimeout();
      autoplay.current.stop();
    };

    const handleSettle = () => {
      clearResumeTimeout();
      // Wait 3s after user interaction ends, then advance once and
      // restart the normal autoplay cycle.
      resumeTimeoutRef.current = setTimeout(() => {
        // If the carousel is destroyed/unmounted, emblaApi will be falsy
        if (!emblaApi) return;
        emblaApi.scrollNext();
        // Reset starts the plugin timing again using its configured delay
        autoplay.current.reset();
      }, 3000);
    };

    emblaApi.on("pointerDown", handlePointerDown);
    emblaApi.on("settle", handleSettle);

    return () => {
      clearResumeTimeout();
      emblaApi.off("pointerDown", handlePointerDown);
      emblaApi.off("settle", handleSettle);
    };
  }, [emblaApi]);

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
          plugins={
            env.NEXT_PUBLIC_DATA_SAVER ? [] : [autoplay.current, fade.current]
          }
          opts={{
            loop: true,
          }}
          setApi={setEmblaApi}
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
                    // The first two slides can become the homepage LCP during
                    // autoplay/fast hydration. Load them eagerly to satisfy
                    // Next.js 16's LCP guidance without eagerly loading the
                    // entire carousel.
                    priority={index < 2}
                    loading={
                      index < 2 ? ("eager" as const) : ("lazy" as const)
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
