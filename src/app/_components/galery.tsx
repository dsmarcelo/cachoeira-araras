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
    <div className='w-full mb-auto mx-auto px-4 max-w-5xl gap-4'>
      <div className='w-full mb-8 max-w-5xl gap-4 grid grid-cols-1 md:grid-cols-2'>
        {images.map((image, index) => (
          <div key={index} className='break-inside-avoid' onClick={() => setImage(image)}>
            <div className='w-full min-h-96 max-h-96 relative rounded-xl overflow-hidden transition-all hover:scale-[101%] hover:shadow-xl'>
              <OptimizedImage
                src={image}
                alt='Foto da Cachoeira das Araras'
                fill
                sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw'
                className='object-cover'
                loading='lazy'
              />
            </div>
          </div>
        ))}
      </div>
      {image && <ImageCard image={image} setImage={setImage} />}
    </div>
  )
}
