import { Button } from '@/components/ui/button';
import { formateDateDayMonthYear } from '@/lib/utils'
import { type Voucher } from '@prisma/client'
import { DownloadIcon, ShareIcon } from 'lucide-react';
import Image from 'next/image'
import React from 'react'

export default function VoucherCard({ data }: { data: Voucher }) {
  const { name, phone, adults, elderly, status, expires_at, code } = data;
  const formatedExpiredDate = expires_at ? formateDateDayMonthYear(expires_at) : '';

  const queryParams = `?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&adults=${adults}&elderly=${elderly}&expires_at=${encodeURIComponent(formatedExpiredDate)}&status=${status}&code=${code}`;
  const imgURL = `http://localhost:3000/api/og${queryParams}`


  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imgURL;
    link.download = 'generated-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    try {
      const response = await fetch(imgURL);
      const blob = await response.blob();
      const file = new File([blob], 'generated-image.png', { type: blob.type });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Check out this image!',
          text: 'Here is a dynamically generated image.',
        });
        console.log('Image shared successfully');
      } else {
        alert('Sharing not supported');
      }
    } catch (error) {
      console.error('Error sharing the image:', error);
    }
  };

  return (
    <div className='w-full'>
      <div className='relative w-full aspect-[2/1]'>
        <Image className='rounded-lg w-full' src={imgURL} fill alt='Voucher' />
      </div>
      <div className='w-full flex justify-center flex-col items-center gap-2 mt-2'>
        <Button variant={'ghost'} className='w-full' onClick={handleDownload}>
          <DownloadIcon className='w-5 h-5 mr-2' />
          Baixar Voucher
        </Button>
        <Button variant={'ghost'} className='w-full' onClick={handleShare}>
          <ShareIcon className='w-5 h-5 mr-2' />
          Compartilhar Voucher
        </Button>
      </div>
    </div>
  )
}
