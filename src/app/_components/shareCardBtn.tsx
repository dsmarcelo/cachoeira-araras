'use client'
import React from 'react'
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ShareIcon } from 'lucide-react';

export default function ShareCardBtn({ imgURL, code }: { imgURL: string, code: string }) {
  const handleShare = async () => {
    try {
      const response = await fetch(imgURL);
      const blob = await response.blob();
      const file = new File([blob], `voucher-${code}.png`, { type: blob.type });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Voucher para cachoeira das araras!',
          text: 'Comprei esse voucher em cachoeiradasararas.com.br',
        });
      } else {
        alert('Compartilhamento não suportado');
      }
    } catch (error) {
      toast({
        title: 'Ação cancelada ou erro ao compartilhar o voucher',
      })
      console.error('Erro ao compartilhar o voucher:', error);
    }
  };

  return (
    <div className='w-full flex justify-center flex-col items-center gap-2'>
      <Button variant={'default'} className='h-12 px-6 rounded-full text-dark bg-light-blue-300 hover:bg-light-blue-300/80' onClick={handleShare}>
        <ShareIcon className='w-5 h-5 mr-2' />
        Compartilhar Voucher
      </Button>
    </div>
  )
}
