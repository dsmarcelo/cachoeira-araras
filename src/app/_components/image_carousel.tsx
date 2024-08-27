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
import { motion } from "framer-motion"

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
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto lg:rounded-2xl lg:mt-8 overflow-hidden"
    >
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
    </motion.div>
  )
}
