'use client';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCcw } from 'lucide-react';

export default function PendingPaymentCard({ paymentURL }: { paymentURL: string }) {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();

  const handlePaymentClick = () => {
    if (!isOnline) {
      toast({
        title: "Sem conexão",
        description: "Você está offline. Verifique sua conexão com a internet antes de continuar.",
        variant: "destructive",
      });
      return;
    }
    router.push(paymentURL);
  };

  const handleRefresh = () => {
    if (!isOnline) {
      toast({
        title: "Sem conexão",
        description: "Você está offline. Verifique sua conexão com a internet antes de atualizar.",
        variant: "destructive",
      });
      return;
    }
    window.location.reload();
  };

  return (
    <div className='mt-12 flex flex-col gap-4 mb-auto mx-auto max-w-xl px-4'>
      <div className='flex flex-col gap-4 text-center'>
        <h2 className='text-2xl font-bold text-primary-100'>
          Pagamento pendente
        </h2>
        <p className='text-lg text-primary-200'>
          Após finalizar o pagamento, atualize a página para ver o status.
        </p>
      </div>

      <Button
        onClick={handlePaymentClick}
        disabled={!isOnline}
        className='h-14 text-lg disabled:opacity-50 disabled:cursor-not-allowed'
      >
        Clique aqui para finalizar o pagamento
      </Button>

      <Button
        onClick={handleRefresh}
        variant="outline"
        disabled={!isOnline}
        className='h-12 disabled:opacity-50 disabled:cursor-not-allowed'
      >
        <RefreshCcw className='mr-2 h-4 w-4' />
        Atualizar página
      </Button>

      {!isOnline && (
        <div className='rounded-xl bg-yellow-500/20 p-4 text-center text-base font-medium text-yellow-200'>
          Você está offline. Verifique sua conexão com a internet.
        </div>
      )}
    </div>
  )
}
