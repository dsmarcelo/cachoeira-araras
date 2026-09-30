"use client";

import { useCallback, useEffect } from "react";
import { api, type RouterInputs } from "@/trpc/react";

export function useVoucherPaymentRecovery() {
  const utils = api.useUtils();
  const refreshPayment = useCallback(
    async (code: string) => {
      const result = await utils.voucher.reconcilePublicPaymentStatus.fetch(
        { code },
        { staleTime: 0 },
      );
      if (result.status === "paid") return { ...result, exists: true };
      const voucher = await utils.voucher.getPublicStatusByCode.fetch({ code });
      if (!voucher) return { ...result, exists: false };
      const preference = await utils.mercadopago.getPublicPreference.fetch({
        preference_id: voucher.preference_id,
      });
      return { ...result, exists: true, checkoutUrl: preference.init_point };
    },
    [utils],
  );
  return { refreshPayment };
}

function useRefreshSummaries(updatedCount: number, dataUpdatedAt: number) {
  const utils = api.useUtils();
  useEffect(() => {
    if (!updatedCount) return;
    void Promise.all([
      utils.voucher.getAdminVoucherSummary.invalidate(),
      utils.voucher.getTodaySummary.invalidate(),
      utils.voucher.getAdminSalesSummary.invalidate(),
    ]);
  }, [updatedCount, dataUpdatedAt, utils]);
}

export function useAdminVoucherPage(
  input: RouterInputs["voucher"]["findAdminPage"],
) {
  const query = api.voucher.findAdminPage.useQuery(input, {
    refetchOnWindowFocus: false,
  });
  useRefreshSummaries(query.data?.updatedCount ?? 0, query.dataUpdatedAt);
  return { ...query, error: query.error, refresh: query.refetch };
}

export function useTodayVoucherPage(
  input: RouterInputs["voucher"]["getTodayPage"],
  enabled = true,
) {
  const query = api.voucher.getTodayPage.useQuery(input, {
    enabled,
    refetchOnWindowFocus: false,
  });
  useRefreshSummaries(query.data?.updatedCount ?? 0, query.dataUpdatedAt);
  return { ...query, refresh: query.refetch };
}

export function useTodayOperationalPage(
  input: RouterInputs["voucher"]["getTodayOperationalPage"],
) {
  const query = api.voucher.getTodayOperationalPage.useQuery(input, {
    refetchOnWindowFocus: false,
  });
  return { ...query, refresh: query.refetch };
}

export function useAdminVoucherDetails(id: number, open: boolean) {
  const query = api.voucher.getAdminDetails.useQuery(
    { id },
    { enabled: open, refetchOnMount: "always" },
  );
  const utils = api.useUtils();
  useEffect(() => {
    if (!query.data?.updated) return;
    // Refresh local list snapshots, but leave page recovery to its bounded loader.
    void Promise.all([
      utils.voucher.findAdminPage.invalidate(),
      utils.voucher.getTodayPage.invalidate(),
      utils.voucher.getAdminVoucherSummary.invalidate(),
      utils.voucher.getTodaySummary.invalidate(),
    ]);
  }, [query.data?.updated, query.dataUpdatedAt, utils]);
  return {
    data: query.data,
    isLoading: query.isFetching,
    error: query.error,
    refresh: query.refetch,
  };
}
