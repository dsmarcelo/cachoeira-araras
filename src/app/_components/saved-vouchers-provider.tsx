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
  readVouchers,
  removeVoucher,
  saveVoucher,
  VOUCHERS_KEY,
  type SavedVoucher,
} from "@/lib/voucher/browser-storage";

const SavedVouchersContext = createContext<{
  vouchers: SavedVoucher[];
  ready: boolean;
  warning: string;
  save: (voucher: SavedVoucher) => boolean;
  remove: (code: string) => Promise<void>;
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

  useEffect(() => {
    let active = true;
    function refresh() {
      try {
        setVouchers(readVouchers(window.localStorage));
      } catch {
        setVouchers([]);
        setWarning(storageWarning);
      }
    }
    refresh();
    async function migrate() {
      try {
        const cookie = await getCookieVoucher();
        if (cookie) {
          const voucher = await convex.query(api.vouchers.getByCode, {
            code: cookie.code,
          });
          if (active && voucher)
            save({ ...cookie, createdAt: voucher.createdAt });
        }
      } catch {
        if (active)
          setWarning(
            "Não foi possível recuperar o voucher anterior. Tente novamente ao recarregar a página. Você ainda pode iniciar uma nova compra.",
          );
      } finally {
        if (active) setReady(true);
      }
    }
    void migrate();
    function onStorage(event: StorageEvent) {
      if (event.key === VOUCHERS_KEY || event.key === null) refresh();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [convex, save]);

  async function remove(code: string) {
    try {
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
      value={{ vouchers, ready, warning, save, remove }}
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
