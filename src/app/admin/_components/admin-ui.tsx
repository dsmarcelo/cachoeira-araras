"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatQuantity } from "@/lib/voucher";

/**
 * Presentational building blocks shared by every /admin screen, so the pages
 * stay a composition of data + these pieces. Zinc neutrals come from the
 * shadcn tokens (`border`, `muted`, …); status colors are fixed here.
 */

/** Standard page column: mobile-first, centered on wider screens. */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** White card surface used for every section. */
export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "form";
}) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-5 pb-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export type Tone = "success" | "warning" | "danger" | "neutral" | "muted";

const toneClasses: Record<Tone, string> = {
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-zinc-200 bg-zinc-100 text-zinc-700",
  muted: "border-zinc-200 bg-zinc-100 text-zinc-500",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type VoucherStatus =
  | "pending"
  | "valid"
  | "redeemed"
  | "expired"
  | "refunded"
  | "cancelled";

export const voucherStatusMeta: Record<
  VoucherStatus,
  { label: string; tone: Tone }
> = {
  valid: { label: "Válido", tone: "success" },
  pending: { label: "Aguardando pagamento", tone: "warning" },
  redeemed: { label: "Resgatado", tone: "neutral" },
  expired: { label: "Expirado", tone: "muted" },
  refunded: { label: "Estornado", tone: "danger" },
  cancelled: { label: "Cancelado", tone: "muted" },
};

export function VoucherStatusBadge({
  status,
  className,
}: {
  status: VoucherStatus;
  className?: string;
}) {
  const meta = voucherStatusMeta[status];
  return (
    <StatusBadge tone={meta.tone} className={className}>
      {meta.label}
    </StatusBadge>
  );
}

/** Pill-shaped segmented control (tabs that filter the same list). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex h-11 gap-0.5 rounded-[10px] bg-muted p-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-lg px-2 text-sm font-medium transition-colors",
              active
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Wrapping row of single-select filter chips. */
export function ChipGroup<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-45",
              active
                ? "border-zinc-900 bg-zinc-900 text-zinc-50"
                : "border-border bg-white text-foreground hover:bg-zinc-50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Icon button that copies `value` and briefly confirms with a check. */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string | null | undefined;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the value is
      // still on screen, so failing quietly here costs nothing.
    }
  }

  return (
    <button
      type="button"
      aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
      disabled={!value}
      onClick={() => void handleCopy()}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-muted disabled:opacity-40",
        copied ? "text-green-700" : "text-muted-foreground",
        className,
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}

export type DetailRow = {
  label: string;
  value: ReactNode;
  /** Raw text to copy; omit for rows that are not copyable. */
  copy?: string | null;
};

/** Bordered label/value list; copyable rows get a trailing copy button. */
export function DetailList({ rows }: { rows: ReadonlyArray<DetailRow> }) {
  return (
    <dl className="flex flex-col rounded-xl border border-border">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={cn(
            "flex min-h-12 items-center gap-3 py-1 pl-3.5 pr-1",
            index > 0 && "border-t border-border",
          )}
        >
          <dt className="w-24 shrink-0 text-[13px] text-muted-foreground">
            {row.label}
          </dt>
          <dd className="min-w-0 flex-1 truncate text-sm font-medium">
            {row.value}
          </dd>
          {row.copy !== undefined ? (
            <CopyButton value={row.copy} label={row.label.toLowerCase()} />
          ) : (
            <span className="w-2" />
          )}
        </div>
      ))}
    </dl>
  );
}

/** Centered message for loading/empty/error states inside a panel or list. */
export function EmptyState({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "error";
}) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "px-4 py-10 text-center text-sm",
        tone === "error" ? "text-red-700" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

/** Visitor count on a voucher (inteiras + meias, pool included). */
export function countPeople(voucher: {
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
}) {
  return voucher.adults + voucher.elderly + voucher.adultsPool + voucher.elderlyPool;
}

/** Previous/next pager with a "Página X de Y" label. */
export function Pager({
  page,
  pageCount,
  onPageChange,
  disabled = false,
  children,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  /** Extra controls shown next to the label (e.g. page size). */
  children?: ReactNode;
}) {
  const total = Math.max(pageCount, 1);
  const arrow =
    "flex size-11 items-center justify-center rounded-lg border border-border bg-white shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-40";
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="Página anterior"
        className={arrow}
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-700">
          Página <span className="font-semibold text-foreground">{page}</span> de {total}
        </span>
        {children}
      </div>
      <button
        type="button"
        aria-label="Próxima página"
        className={arrow}
        disabled={disabled || page >= total}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}

/** Search field with a leading magnifier icon. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  maxLength = 120,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  return (
    <label className="relative block">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900"
      />
    </label>
  );
}

/** "2 inteiras e 1 meia · piscina"-style summary of a voucher's entries. */
export function describeEntries(voucher: {
  adults: number;
  elderly: number;
  adultsPool: number;
  elderlyPool: number;
}) {
  return formatQuantity({
    adults: voucher.adults,
    elderly: voucher.elderly,
    adults_pool: voucher.adultsPool,
    elderly_pool: voucher.elderlyPool,
  });
}
