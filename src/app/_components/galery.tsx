import { OptimizedImage } from '@/components/ui/optimized-image';
import React from 'react'

export default function ImageGallery({ images }: { images: string[] }) {
  return (
    <div className='w-full mb-auto mx-auto px-4 max-w-5xl'>
      {/* CSS columns masonry: each image keeps its natural aspect ratio (no crop). */}
      <div className='mb-8 columns-1 gap-4 md:columns-2'>
        {images.map((image, index) => (
          <div key={index} className='mb-4 break-inside-avoid'>
            <OptimizedImage
              src={image}
              alt='Foto da Cachoeira das Araras'
              width={1200}
              height={1600}
              sizes='(max-width: 768px) 100vw, 50vw'
              className='h-auto w-full rounded-xl'
              loading='lazy'
            />
          </div>
        ))}
      </div>
    </div>
  )
}
