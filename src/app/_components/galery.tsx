'use client'
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import React, { useState } from 'react'

function ImageCard({ image, setImage }: { image: string, setImage: (image: string) => void }) {
  console.log('first')
  return (
    <div className='fixed w-screen h-full inset-0 z-10 bg-black/90' onClick={() => setImage('')}>
      <Button variant={'ghost'} className='text-primary-50 float-right' onClick={() => setImage('')}>Fechar</Button>
      <div className='w-full h-screen absolute flex justify-center z-20 items-center' onClick={() => { return null }}>
        <div className='w-screen max-w-5xl h-screen relative rounded-xl overflow-hidden'>
          <Image
            src={image}
            alt=''
            fill
            sizes='100vw'
            quality={100}
            className='object-contain'
          />
        </div>
      </div>
    </div>);
}

export default function ImageGallery({ images }: { images: string[] }) {
  const [image, setImage] = useState<string>('')

  return (
    <div className='w-full mb-auto max-w-5xl gap-4 grid grid-cols-1 md:grid-cols-2'>
      {images.map((image, index) => (
        <div key={index} className='break-inside-avoid' onClick={() => setImage(image)}>
          <div className='w-full min-h-96 max-h-96 relative rounded-xl overflow-hidden transition-all hover:scale-[101%] hover:shadow-xl'>
            <Image
              src={image}
              alt=''
              fill
              sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw'
              className='object-cover'
            />
          </div>
        </div>
      ))}
      {image && <ImageCard image={image} setImage={setImage} />}
    </div>
  )
}
