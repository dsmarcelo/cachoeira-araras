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
import Link from "next/link"

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
    <Link href="/galeria" className="w-full max-w-5xl mx-auto lg:rounded-2xl lg:mt-8 overflow-hidden">
      <Carousel
        plugins={[autoplay.current, fade.current]}
        opts={{
          loop: true,
        }}
      >
        <CarouselContent>
          {getImages().map((image, index) => (
            <CarouselItem key={index} className="w-full aspect-[2/1] md:max-tall:aspect-[3/1]">
              <div className="w-full h-full relative">
                <Image
                  src={image}
                  alt="Imagem"
                  fill
                  className="object-cover"
                  quality={85}
                  priority
                  sizes="(max-width: 768px) 100vw, 75vw"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </Link>
  )
}
