import React from 'react'
import ImageGallery from '../_components/galery';

export default function page() {
  const getImages = () => {
    const quantity = 4;
    const images = [];

    for (let i = 0; i < quantity; i++) {
      images.push(`/images/cachoeira/${i + 1}.jpg`);
    };
    return images;
  }

  return (
    <div className='w-full mb-auto flex justify-center my-4 pb-4 px-4'>
      <ImageGallery images={getImages()} />
    </div>
  )
}
