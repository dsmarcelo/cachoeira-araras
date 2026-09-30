"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";

import { getErrorMessage } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

const networkMessage =
  "Não foi possível verificar a compra agora. Confira sua conexão e tente novamente em instantes.";

/**
 * Sends the buyer to where the server says a purchase can continue: the
 * internal checkout, a still-valid Checkout Pro address, or the receipt when
 * it is already paid. Every entry point (form, pending-purchase dialog, Meus
 * Vouchers, result page) resumes through this, so a saved address never
 * replaces the server check. Resolves with a readable message when the buyer
 * stays put: a refusal from the server (not found, not authorized, purchase
 * ended) keeps its own text, while a failed request is reported as a
 * connection problem and never as a missing purchase.
 */
export function useResumePayment() {
  const resumePayment = useMutation(api.vouchers.resumePayment);
  const router = useRouter();

  return useCallback(
    async (args: {
      code: string;
      managementToken: string;
      savedInitPoint?: string;
    }): Promise<string | null> => {
      try {
        const result = await resumePayment(args);
        if (result.kind === "resumed") {
          // Internal pages keep the app running; Pro is an external address.
          if (result.checkoutUrl.startsWith("/"))
            router.push(result.checkoutUrl);
          else window.location.assign(result.checkoutUrl);
          return null;
        }
        if (result.kind === "already_paid") {
          router.push(result.redirectUrl);
          return null;
        }
        return result.message;
      } catch (error) {
        return getErrorMessage(error, networkMessage);
      }
    },
    [resumePayment, router],
  );
}
