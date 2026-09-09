"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useConvex } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { deleteCookieVoucher, getCookieVoucher } from "../lib";
import {
  canRemoveVoucher,
  isVoucherRemoved,
  readVouchers,
  removeVoucher,
  saveVoucher,
  touchFinancialEvent,
  VOUCHERS_KEY,
  type SavedVoucher,
} from "@/lib/voucher/browser-storage";
import { setCachedLookupToken } from "@/lib/voucher/lookup-token-cache";

const SavedVouchersContext = createContext<{
  vouchers: SavedVoucher[];
  ready: boolean;
  warning: string;
  save: (voucher: SavedVoucher) => boolean;
  remove: (code: string) => Promise<void>;
  touchEvent: (
    code: string,
    options?: { eventAt?: number; hasPendingRefund?: boolean },
  ) => void;
} | null>(null);

export function SavedVouchersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const convex = useConvex();
  const [vouchers, setVouchers] = useState<SavedVoucher[]>([]);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState("");
  const storageWarning =
    "Não foi possível salvar seus vouchers neste navegador. Anote o código antes de sair para poder consultar seu pagamento.";

  const save = useCallback((voucher: SavedVoucher) => {
    try {
      setVouchers(saveVoucher(window.localStorage, voucher));
      return true;
    } catch {
      setWarning(storageWarning);
      return false;
    }
  }, []);

  const touchEvent = useCallback(
    (
      code: string,
      options?: { eventAt?: number; hasPendingRefund?: boolean },
    ) => {
      try {
        setVouchers(touchFinancialEvent(window.localStorage, code, options));
      } catch {
        // ignore
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    function refresh(retainExpiredCandidates = false) {
      try {
        setVouchers(
          readVouchers(window.localStorage, Date.now(), {
            retainExpiredCandidates,
          }),
        );
      } catch {
        setVouchers([]);
        setWarning(storageWarning);
      }
    }
    // Keep expired capable entries until the server has had one chance to
    // reveal a refund event that extends their retention window.
    refresh(true);
    async function migrate() {
      let retentionReconciled = false;
      try {
        const candidates = readVouchers(window.localStorage, Date.now(), {
          retainExpiredCandidates: true,
        });
        for (let offset = 0; offset < candidates.length; offset += 50) {
          const batch = candidates.slice(offset, offset + 50);
          const notices = await convex.query(
            api.refunds.getRefundNoticesForVouchers,
            {
              vouchers: batch.flatMap((voucher) =>
                voucher.managementToken
                  ? [
                      {
                        code: voucher.code,
                        managementToken: voucher.managementToken,
                      },
                    ]
                  : [],
              ),
            },
          );
          for (const voucher of batch) {
            const voucherNotices = notices.filter(
              (notice) => notice.voucherCode === voucher.code,
            );
            if (voucherNotices.length === 0) continue;
            touchFinancialEvent(window.localStorage, voucher.code, {
              eventAt: Math.max(
                ...voucherNotices.map((notice) => notice.updatedAt),
              ),
              hasPendingRefund: voucherNotices.some(
                (notice) => notice.status !== "completed",
              ),
            });
          }
        }
        retentionReconciled = true;

        const cookie = await getCookieVoucher();
        if (cookie) {
          if (isVoucherRemoved(window.localStorage, cookie.code)) {
            await deleteCookieVoucher(cookie.code);
            return;
          }
          const authorization = await convex.mutation(
            api.vouchers.authorizeLookup,
            { code: cookie.code },
          );
          if (authorization.kind === "authorized") {
            setCachedLookupToken(cookie.code, authorization.lookupToken);
            if (active)
              save({ ...cookie, createdAt: authorization.voucher.createdAt });
          }
        }
      } catch {
        if (active)
          setWarning(
            "Não foi possível recuperar o voucher anterior. Tente novamente ao recarregar a página. Você ainda pode iniciar uma nova compra.",
          );
      } finally {
        if (active) {
          refresh(!retentionReconciled);
          setReady(true);
        }
      }
    }
    void migrate();
    function onStorage(event: StorageEvent) {
      if (event.key === VOUCHERS_KEY || event.key === null) refresh();
    }
    function onFocus() {
      refresh();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [convex, save]);

  async function remove(code: string) {
    try {
      const current = readVouchers(window.localStorage);
      const target = current.find((entry) => entry.code === code);
      if (target && !canRemoveVoucher(target)) {
        setWarning(
          "Este voucher possui um reembolso em andamento e não pode ser removido.",
        );
        return;
      }
      // Clear only the matching pointer, before removal, so migration cannot restore it.
      await deleteCookieVoucher(code);
      setVouchers(removeVoucher(window.localStorage, code));
    } catch {
      setWarning(
        "Não foi possível remover o voucher deste navegador. Tente novamente.",
      );
    }
  }

  return (
    <SavedVouchersContext.Provider
      value={{ vouchers, ready, warning, save, remove, touchEvent }}
    >
      {children}
    </SavedVouchersContext.Provider>
  );
}

export function useSavedVouchers() {
  const context = useContext(SavedVouchersContext);
  if (!context) throw new Error("SavedVouchersProvider is required");
  return context;
}

export function MyVouchersLink() {
  const { ready, vouchers } = useSavedVouchers();
  return ready && vouchers.length > 0 ? (
    <Link href="/meus-vouchers" className="px-2 text-sm underline">
      Meus Vouchers
    </Link>
  ) : null;
}
