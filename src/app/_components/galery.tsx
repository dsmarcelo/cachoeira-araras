'use client'
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import React, { useState } from 'react'
// import LogoBar from '/logo-bar.svg';

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

type ImageGalleryProps = {
  cachoeira: string[];
  bar: string[];
}

export default function ImageGallery({ images }: { images: ImageGalleryProps }) {
  const [image, setImage] = useState<string>('')

  return (
    <div className='w-full mb-auto mx-auto px-4 max-w-5xl gap-4'>
      <div className='w-full mb-8 max-w-5xl gap-4 grid grid-cols-1 md:grid-cols-2'>
        {images.cachoeira.map((image, index) => (
          <div key={index} className='break-inside-avoid' onClick={() => setImage(image)}>
            <div className='w-full min-h-96 max-h-96 relative rounded-xl overflow-hidden transition-all hover:scale-[101%] hover:shadow-xl'>
              <Image
                src={image}
                alt=''
                fill
                quality={70}
                sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw'
                className='object-cover'
              />
            </div>
          </div>
        ))}
      </div>
      {/* <div className='h-96 w-screen bg-[#79804d] my-4 '></div> */}
      <Image src='/logo-bar.svg' alt='' width={200} height={200} className='w-96 h-[auto] mx-auto' />
      <div className='w-full mb-auto mt-8 max-w-5xl gap-4 grid grid-cols-1 md:grid-cols-2'>
        {images.bar.map((image, index) => (
          <div key={index} className='break-inside-avoid' onClick={() => setImage(image)}>
            <div className='w-full min-h-96 max-h-96 relative rounded-xl overflow-hidden transition-all hover:scale-[101%] hover:shadow-xl'>
              <Image
                src={image}
                alt=''
                fill
                quality={70}
                sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw'
                className='object-cover'
              />
            </div>
          </div>
        ))}
      </div>
      {image && <ImageCard image={image} setImage={setImage} />}
      {/* <LogoBar className='w-12 h-12' /> */}
    </div>
  )
}
