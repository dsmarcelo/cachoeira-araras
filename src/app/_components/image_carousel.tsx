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
import useEmblaCarousel from "embla-carousel-react"

export function ImageCarousel() {
  const [emblaRef] = useEmblaCarousel({ loop: true }, [Fade()])
  const autoplay = React.useRef(
    Autoplay({ delay: 10000 }),
  )
  const fade = React.useRef(Fade())

  const images = ["/images/cachoeira1.jpeg", "/images/cachoeira2.jpeg"]

  return (
    <Carousel
      plugins={[autoplay.current, fade.current]}
      ref={emblaRef}
      className="w-full aspect-video max-w-5xl my-0 p-0 mx-auto md:rounded-2xl md:mt-8 overflow-hidden"
      onMouseEnter={autoplay.current.stop}
      onMouseLeave={autoplay.current.reset}
    >
      <CarouselContent>
        {images.map((image, index) => (
          <CarouselItem key={index}>
            <div className="w-full aspect-video">
              <Image src={image} alt="Imagem" fill className="object-cover" />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
