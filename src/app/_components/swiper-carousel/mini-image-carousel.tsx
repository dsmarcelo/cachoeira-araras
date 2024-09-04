'use client'
import * as React from "react"
import Autoplay from "embla-carousel-autoplay"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import Image from "next/image"
import { motion } from "framer-motion"

export function MiniImageCarousel() {
  const autoplay = React.useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true }),
  )

  const getImages = () => {
    const cQuantity = 4;
    const bQuantity = 8;
    const images = [];

    for (let i = 0; i < cQuantity; i++) {
      images.push(`/images/cachoeira/${i + 1}.jpg`);
    };
    for (let i = 0; i < bQuantity; i++) {
      images.push(`/images/bar/${i + 1}.jpg`);
    };
    return images;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto rounded-2xl overflow-hidden"
    >
      <div>
        <Carousel
          plugins={[autoplay.current]}
          opts={{
            loop: true,
          }}
        >
          <CarouselContent className="rounded-xl">
            {getImages().map((image, index) => (
              <CarouselItem key={index} className="w-full max-h-[80vh] aspect-square sm:basis-1/2 lg:basis-1/3">
                <div className="w-full h-full relative">
                  <Image
                    src={image}
                    alt="Imagem"
                    fill
                    unoptimized
                    className="transition object-cover rounded-xl hover:scale-[98%]"
                    quality={70}
                    priority
                    sizes="(max-width: 640px) 90vw, (max-width: 740px) 50vw 33vw"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious variant={'ghost'} />
          <CarouselNext variant={'ghost'} />
        </Carousel>
      </div>
    </motion.div>
  )
}
