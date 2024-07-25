'use client'
import * as React from "react"
import Autoplay from "embla-carousel-autoplay"
import Fade from 'embla-carousel-fade'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import Image from "next/image"

export function ImageCarousel() {
  const autoplay = React.useRef(
    Autoplay({ delay: 5000 }),
  )
  const fade = React.useRef(Fade())

  const getImages = () => {
    const quantity = 4;
    const images = [];

    for (let i = 0; i < quantity; i++) {
      images.push(`/images/carousel/${i + 1}.jpg`);
    };
    return images;
  }

  return (
    <Carousel
      plugins={[autoplay.current, fade.current]}
      opts={{
        loop: true,
      }}
      className="w-full aspect-[2/1] max-w-5xl mx-auto lg:rounded-2xl lg:mt-8 overflow-hidden"
    >
      <CarouselContent>
        {getImages().map((image, index) => (
          <CarouselItem key={index}>
            <div className="w-full my-auto aspect-video object-center relative">
              <Image
                src={image}
                alt="Imagem"
                fill className="object-cover"
                quality={100}
                priority
                sizes="(max-width: 768px) 100vw, 75vw"
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
