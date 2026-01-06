"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { TRPCClientError } from "@trpc/client";

/**
 * Custom hook to handle tRPC errors globally
 * Provides functions to show appropriate toast messages based on error type
 *
 * @returns {Object} Error handling functions
 * @returns {Function} handleError - Handle tRPC errors and show toast
 * @returns {Function} showErrorToast - Show error toast with custom message
 * @returns {Function} showSuccessToast - Show success toast
 * @returns {Function} showWarningToast - Show warning toast
 */
export function useTrpcErrorHandler() {
  const { toast } = useToast();

  /**
   * Determines if an error is a network error
   */
  const isNetworkError = (error: unknown): boolean => {
    if (error instanceof TRPCClientError) {
      const message = error.message.toLowerCase();
      return (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("failed to fetch") ||
        message.includes("networkerror") ||
        message.includes("timeout")
      );
    }
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("failed to fetch") ||
        message.includes("networkerror") ||
        message.includes("timeout")
      );
    }
    return false;
  };

  /**
   * Handles tRPC errors and shows appropriate toast notifications
   *
   * @param error - The error to handle
   * @param customMessage - Optional custom error message
   */
  const handleError = useCallback(
    (error: unknown, customMessage?: string) => {
      console.error("tRPC Error:", error);

      // Network errors
      if (isNetworkError(error)) {
        toast({
          title: "Erro de conexão",
          description:
            customMessage ??
            "Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // tRPC Client Errors
      if (error instanceof TRPCClientError) {
        // Validation errors
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.data?.zodError) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const zodError = error.data.zodError;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const fieldErrors = zodError.fieldErrors ?? {};
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
          const firstErrorArray = Object.values(fieldErrors)[0];
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const firstError = Array.isArray(firstErrorArray)
            ? firstErrorArray[0]
            : undefined;
          toast({
            title: "Erro de validação",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            description:
              customMessage ??
              firstError ??
              "Por favor, verifique os dados informados.",
            variant: "destructive",
          });
          return;
        }

        // Unauthorized errors
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (error.data?.code === "UNAUTHORIZED") {
          toast({
            title: "Não autorizado",
            description:
              customMessage ??
              "Você não tem permissão para realizar esta ação.",
            variant: "destructive",
          });
          return;
        }

        // Generic tRPC errors
        toast({
          title: "Erro",
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          description:
            customMessage ??
            error.message ??
            "Ocorreu um erro inesperado. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Generic Error objects
      if (error instanceof Error) {
        toast({
          title: "Erro",
          description:
            customMessage ??
            error.message ??
            "Ocorreu um erro inesperado. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      // Unknown error type
      toast({
        title: "Erro",
        description:
          customMessage ??
          "Ocorreu um erro inesperado. Por favor, tente novamente.",
        variant: "destructive",
      });
    },
    [toast],
  );

  /**
   * Shows an error toast with custom message
   */
  const showErrorToast = useCallback(
    (title: string, description?: string) => {
      toast({
        title,
        description,
        variant: "destructive",
      });
    },
    [toast],
  );

  /**
   * Shows a success toast
   */
  const showSuccessToast = useCallback(
    (title: string, description?: string) => {
      toast({
        title,
        description,
        variant: "default",
      });
    },
    [toast],
  );

  /**
   * Shows a warning toast
   */
  const showWarningToast = useCallback(
    (title: string, description?: string) => {
      toast({
        title,
        description,
        variant: "default",
      });
    },
    [toast],
  );

  return {
    handleError,
    showErrorToast,
    showSuccessToast,
    showWarningToast,
  };
}
