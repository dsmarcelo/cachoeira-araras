'use client'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { motion } from "framer-motion"

export function MiniImageCarousel() {
  const getImages = () => {
    return [
      "/images/mini-cachoeira-1.avif",
      "/images/mini-cachoeira-2.avif",
      "/images/mini-bar-1.avif",
      "/images/mini-bar-2.avif",
      "/images/mini-bar-3.avif",
    ];
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
          opts={{
            loop: true,
          }}
        >
          <CarouselContent className="rounded-xl">
            {getImages().map((image, index) => (
              <CarouselItem key={index} className="w-full max-h-[80vh] aspect-square sm:basis-1/2 lg:basis-1/3">
                <div className="w-full h-full relative">
                  <OptimizedImage
                    src={image}
                    alt="Foto da Cachoeira das Araras"
                    fill
                    quality={60}
                    className="transition object-cover rounded-xl hover:scale-[98%]"
                    priority={index < 1}
                    loading={index < 1 ? 'eager' as const : 'lazy' as const}
                    sizes="(max-width: 640px) 90vw, (max-width: 740px) 50vw 33vw"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious variant={'ghost'} className='invisible sm:visible' />
          <CarouselNext variant={'ghost'} className='invisible sm:visible' />
        </Carousel>
      </div>
    </motion.div>
  )
}
