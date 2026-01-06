"use client";

import { useEffect } from "react";
import ErrorCard from "@/app/erro/error";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HomeIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function VoucherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { toast } = useToast();

  useEffect(() => {
    // Show toast notification when error occurs
    toast({
      title: "Erro ao carregar voucher",
      description:
        error.message ||
        "Não foi possível carregar as informações do voucher. Por favor, tente novamente.",
      variant: "destructive",
    });
  }, [error, toast]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
      <ErrorCard
        title="Erro"
        message={
          error.message ||
          "Não foi possível carregar as informações do voucher. Por favor, verifique o link e tente novamente."
        }
        variant="home"
        light={false}
      >
        <div className="mt-4 flex flex-col gap-4">
          <Button onClick={reset} className="h-12">
            Tente novamente
          </Button>
          <Link href="/">
            <Button variant="outline" className="h-12">
              <HomeIcon className="mr-2 h-4 w-4" />
              Voltar para a página inicial
            </Button>
          </Link>
        </div>
      </ErrorCard>
    </div>
  );
}


