import React from 'react'
import ImageGallery from '../../_components/galery';

export default function page() {
  const getImages = () => {
    const cachoeiraQuantity = 4;
    const barQuantity = 8;

    type ImageGalleryProps = {
      cachoeira: string[];
      bar: string[];
    }

    const images: ImageGalleryProps = { cachoeira: [], bar: [] };

    for (let i = 0; i < cachoeiraQuantity; i++) {
      images.cachoeira.push(`/images/cachoeira/${i + 1}.jpg`);
    };
    for (let i = 0; i < barQuantity; i++) {
      images.bar.push(`/images/bar/${i + 1}.jpg`);
    };
    return images;
  }

  return (
    <div className='w-full mb-auto justify-center pb-4'>
      <div className='flex w-full items-center justify-center bg-dark-blue pb-2 mx-auto rounded-b-xl md:rounded-b-3xl mb-4 md:mb-8'>
        <h1 className='text-xl md:text-3xl font-bold text-primary-50'>Galeria de Fotos</h1>
      </div>
      <ImageGallery images={getImages()} />
    </div>
  )
}
