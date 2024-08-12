import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { formateDateDayMonthYear, formatPhone, truncateName } from '@/lib/utils'
import { formatQuantity } from '@/lib/voucher';
import { type Voucher } from '@prisma/client'
import { ShareIcon } from 'lucide-react';
import Image from 'next/image'
import React from 'react'

export default function VoucherCard({ data }: { data: Voucher }) {
  const { name, phone, adults, elderly, status, expires_at, code } = data;
  const formatedExpiredDate = expires_at ? formateDateDayMonthYear(expires_at) : '';
  const formatedName = truncateName(name);
  const formatedPhone = formatPhone(phone);
  const formatedQuantity = formatQuantity({ adults, elderly });

  let url = ''
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    url = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  } else if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    url = `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
  } else {
    url = 'http://localhost:3000'
  }

  const queryParams = `?name=${encodeURIComponent(formatedName)}&phone=${encodeURIComponent(formatedPhone)}&quantity=${formatedQuantity}&expires_at=${encodeURIComponent(formatedExpiredDate)}&status=${status}&code=${code}`;
  const imgURL = `${url}/api/og${queryParams}`

  const handleShare = async () => {
    try {
      const response = await fetch(imgURL);
      const blob = await response.blob();
      const file = new File([blob], `voucher-${code}.png`, { type: blob.type });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Comprei um voucher para cachoeira das araras!',
          text: 'Comprei esse voucher em cachoeiradasararas.com.br',
        });
      } else {
        alert('Compartilhamento não suportado');
      }
    } catch (error) {
      toast({
        title: 'Erro ao compartilhar o voucher',
      })
      console.error('Erro ao compartilhar o voucher:', error);
    }
  };

  return (
    <div className='w-full'>
      <div className='relative w-full aspect-[2/1]'>
        <Image className='rounded-lg w-full' src={imgURL} fill sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw' alt='Voucher' />
      </div>
      <div className='w-full flex justify-center flex-col items-center gap-2 mt-2'>
        <Button variant={'default'} className='w-full bg-bg-blue' onClick={handleShare}>
          <ShareIcon className='w-5 h-5 mr-2' />
          Compartilhar Voucher
        </Button>
      </div>
    </div>
  )
}
