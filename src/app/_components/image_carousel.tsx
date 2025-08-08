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
import { motion } from "framer-motion"

export function ImageCarousel() {
  const autoplay = React.useRef(
    Autoplay({ delay: 5000 }),
  )
  const fade = React.useRef(Fade())

  const getImages = () => {
    const quantity = 10;
    const images = [];

    for (let i = 0; i < quantity; i++) {
      images.push(`/images/carousel/${i + 1}.jpg`);
    };
    return images;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto lg:rounded-2xl overflow-hidden"
    >
      <div className="w-full max-w-5xl mx-auto lg:rounded-2xl overflow-hidden">
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
                    priority
                    sizes="(max-width: 768px) 100vw, 75vw"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-bg-blue via-transparent via-15% to-transparent lg:hidden"></div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </motion.div>
  )
}
