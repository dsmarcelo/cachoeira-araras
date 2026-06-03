'use client'
import { Button } from '@/components/ui/button';
import { OptimizedImage } from '@/components/ui/optimized-image';
import React, { useState } from 'react'

function ImageCard({ image, setImage }: { image: string, setImage: (image: string) => void }) {
  return (
    <div className='fixed w-screen h-full inset-0 z-10 bg-black/90' onClick={() => setImage('')}>
      <Button variant={'ghost'} className='text-primary-50 float-right' onClick={() => setImage('')}>Fechar</Button>
      <div className='w-full h-screen absolute flex justify-center z-20 items-center' onClick={(event) => event.stopPropagation()}>
        <div className='w-screen max-w-5xl h-screen relative rounded-xl overflow-hidden'>
          <OptimizedImage
            src={image}
            alt='Foto ampliada da Cachoeira das Araras'
            fill
            sizes='100vw'
            className='object-contain'
            priority={false}
            loading='lazy'
          />
        </div>
      </div>
    </div>);
}

export default function ImageGallery({ images }: { images: string[] }) {
  const [image, setImage] = useState<string>('')

  return (
    <div className='w-full mb-auto mx-auto px-4 max-w-5xl'>
      {/* CSS columns masonry: each image keeps its natural aspect ratio (no crop). */}
      <div className='mb-8 columns-1 gap-4 md:columns-2'>
        {images.map((image, index) => (
          <button
            key={index}
            type='button'
            className='mb-4 block w-full break-inside-avoid cursor-pointer rounded-xl transition-all hover:scale-[101%] hover:shadow-xl'
            onClick={() => setImage(image)}
          >
            <OptimizedImage
              src={image}
              alt='Foto da Cachoeira das Araras'
              width={1200}
              height={1600}
              sizes='(max-width: 768px) 100vw, 50vw'
              className='h-auto w-full rounded-xl'
              loading='lazy'
            />
          </button>
        ))}
      </div>
      {image && <ImageCard image={image} setImage={setImage} />}
    </div>
  )
}
