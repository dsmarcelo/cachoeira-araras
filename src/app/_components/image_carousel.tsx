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
    Autoplay({ delay: 10000 }),
  )
  const fade = React.useRef(Fade())

  const images = ["/images/cachoeira1.jpeg", "/images/cachoeira2.jpeg"]

  return (
    <Carousel
      plugins={[autoplay.current, fade.current]}
      opts={{
        loop: true,
      }}
      className="w-full aspect-[2/1] max-w-5xl mx-auto lg:rounded-2xl lg:mt-8 overflow-hidden"
    >
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem key={index}>
            <div className="w-full my-auto aspect-video object-center">
              <Image src={image} alt="Imagem" fill className="object-cover " />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
