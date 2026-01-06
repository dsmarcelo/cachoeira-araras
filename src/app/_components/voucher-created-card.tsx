'use client'
import { Button } from '@/components/ui/button'
import React from 'react'
import { deleteCookieVoucher } from '../lib'
import { FaArrowLeft } from 'react-icons/fa'
import { toast } from '@/components/ui/use-toast'
import { motion } from 'framer-motion'
import DeleteVoucherCookieBtn from './delete-voucher-cookie-btn'
import { RefreshCcw } from 'lucide-react'
import { api } from '@/trpc/react'
import { useTrpcErrorHandler } from '@/hooks/use-trpc-error-handler'
import { useNetworkStatus } from '@/hooks/use-network-status'

export default function VoucherCreatedCard(
  { code, init_point, redirectToPayment, setCode, payment_success_url }:
    { code: string, init_point: string, redirectToPayment: () => void, setCode: React.Dispatch<React.SetStateAction<string>>, payment_success_url: string }) {

  const utils = api.useUtils();
  const { handleError, showErrorToast } = useTrpcErrorHandler();
  const { isOnline } = useNetworkStatus();
  const [isCheckingPayment, setIsCheckingPayment] = React.useState(false);

  async function handleClick(showToast = true) {
    setCode('')
    await deleteCookieVoucher()
    if (showToast) {
      toast({
        title: 'Voucher deletado',
        description: 'Voucher deletado, por favor, tente novamente',
      })
    }
  }

  if (!init_point && !payment_success_url) {
    return (
      <motion.div
        className='p-4'
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className='flex flex-col gap-6'>
          <p className='text-primary-100 font-medium'>Ocorreu um erro ao criar o voucher, por favor, volte e tente novamente</p>
          <Button onClick={() => handleClick(true)} className='mb-4 h-12 text-primary-50'>
            <FaArrowLeft className='mr-2 h-3 w-3' />
            <p>Voltar</p>
          </Button>
        </div>
      </motion.div>
    )
  }

  async function checkPaymentStatus() {
    if (!isOnline) {
      return showErrorToast(
        "Sem conexão",
        "Você está offline. Verifique sua conexão com a internet e tente novamente."
      );
    }

    setIsCheckingPayment(true);
    try {
      const voucher = await utils.voucher.findByCode.fetch({ code });
      if (!voucher) {
        toast({
          title: "Voucher não encontrado",
          description: "Não foi possível encontrar o voucher. Recarregando a página...",
          variant: "destructive",
        });
        setTimeout(() => location.reload(), 2000);
        return;
      }
      if (!voucher.payment_id) {
        return redirectToPayment();
      }
      if (voucher?.status === 'pending') {
        redirectToPayment();
        return;
      }
      if (payment_success_url) {
        location.href = payment_success_url;
      } else {
        toast({
          title: "Erro",
          description: "URL de sucesso não disponível. Recarregando a página...",
          variant: "destructive",
        });
        setTimeout(() => location.reload(), 2000);
      }
    } catch (error) {
      handleError(error, "Erro ao verificar o status do pagamento. Tente novamente.");
    } finally {
      setIsCheckingPayment(false);
    }
  }

  function AlreadyPayedButton() {
    return (
      <div className="flex flex-col gap-4 text-center text-lg">
        Ja finalizou o pagamento? Clique no botão abaixo para atualizar a pagina
        <Button className="w-full h-16 text-xl rounded-xl" onClick={() => location.reload()}>
          <RefreshCcw className='mr-2 h-4 w-4' />
          Atualizar página
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      className='p-4'
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className='flex flex-col gap-6'>
        {payment_success_url ? (
          <div className='p-4'>
            <p className='text-green-100 font-medium text-xl mb-4'>Já recebemos seu pagamento, clique no botão abaixo para visualizar o voucher:</p>
            <Button className='bg-positive-green h-14 text-xl w-full' onClick={() => window.open(payment_success_url)}>Visualizar voucher</Button>
          </div>) : (
          <div className='flex flex-col gap-6'>
            <div className='w-12'><DeleteVoucherCookieBtn label='Voltar' refresh={true} message='Se você já pagou e ainda não está vendo o botão para visualizar o voucher, atualize a pagina e tente novamente.' /></div>
            <p className='text-primary-100 font-medium'>Voucher criado com sucesso! Guarde o codigo abaixo, finalize o pagamento clicando no botão abaixo e volte ao site para utiliza-lo:</p>
            <h2 className='text-7xl font-bold text-center text-primary-50'>{code}</h2>
            <Button
              onClick={checkPaymentStatus}
              disabled={isCheckingPayment || !isOnline}
              className='bg-positive-green rounded-xl text-center h-14 text-xl w-full flex justify-center items-center font-medium text-primary-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isCheckingPayment ? (
                <p className='translate-y-[-2px]'>Verificando...</p>
              ) : (
                <p className='translate-y-[-2px]'>Finalizar pagamento</p>
              )}
            </Button>
            {!isOnline && (
              <p className='text-center text-sm text-yellow-200'>
                Você está offline. Verifique sua conexão com a internet.
              </p>
            )}
            <AlreadyPayedButton />
          </div>
        )}
      </div>
    </motion.div>
  )
}
