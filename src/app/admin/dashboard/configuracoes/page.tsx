"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Minus, Plus, X } from "lucide-react";

import { api } from "../../../../../convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MultipleDaysCalendar from "@/components/ui/multiple-days-calendar";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { EmptyState, PageShell, Panel, PanelHeader } from "../../_components/admin-ui";

/** Sales switches: each one saves as soon as it is flipped. */
const TOGGLES = [
  { key: "enable.voucher.buy", label: "Voucher day use" },
  { key: "enable.voucher.pool.buy", label: "Voucher com piscina" },
  { key: "enable.voucher.half-price.buy", label: "Meia entrada" },
  { key: "enable.voucher.half-price.pool.buy", label: "Meia entrada com piscina" },
] as const;

/** Numeric settings edited with steppers; saved by the bottom bar. */
const LIMITS = [
  { key: "voucher.max.quantity.adults", label: "Inteiras", sub: "Voucher day use", fallback: 20 },
  { key: "voucher.max.quantity.elderly", label: "Meias", sub: "Voucher day use", fallback: 20 },
  { key: "voucher.max.quantity.adults.pool", label: "Inteiras", sub: "Voucher com piscina", fallback: 20 },
  { key: "voucher.max.quantity.elderly.pool", label: "Meias", sub: "Voucher com piscina", fallback: 20 },
] as const;

const MESSAGES = [
  { key: "top.message", label: "Mensagem no topo do site", max: 200 },
  { key: "form.message", label: "Mensagem no formulário de compra", max: 300 },
] as const;

const MAX_DAYS_KEY = "max.intended.days";
const DISABLED_DAYS_KEY = "disabled.days";
const LIMIT_MAX = 50;

type DraftValue = number | string | string[];
type StoredSetting = { key: string; value: unknown; updatedBy?: string; updatedAt?: number };

const DAY_KEY = "yyyy-MM-dd";
const toDate = (key: string) => parse(key, DAY_KEY, new Date());

/**
 * Site settings (`settings` table). Switches write immediately; limits,
 * messages and scheduling are edited as a draft and saved together from the
 * bottom bar. Every value reaches visitors live, without a reload.
 */
export default function ConfiguracoesPage() {
  const settings = useQuery(api.settings.list);
  const setSetting = useMutation(api.settings.set);
  const [draft, setDraft] = useState<Record<string, DraftValue>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savingToggle, setSavingToggle] = useState<string | null>(null);

  if (settings === undefined) {
    return (
      <PageShell>
        <Panel>
          <EmptyState>Carregando configurações...</EmptyState>
        </Panel>
      </PageShell>
    );
  }

  const byKey = new Map<string, StoredSetting>(settings.map((s) => [s.key, s]));
  const stored = <T,>(key: string, fallback: T): T => (byKey.get(key)?.value as T | undefined) ?? fallback;
  const current = <T extends DraftValue>(key: string, fallback: T): T =>
    (draft[key] as T | undefined) ?? stored(key, fallback);
  const edit = (key: string, value: DraftValue) => setDraft((prev) => ({ ...prev, [key]: value }));
  const dirtyKeys = Object.keys(draft).filter(
    (key) => JSON.stringify(draft[key]) !== JSON.stringify(byKey.get(key)?.value),
  );

  async function flip(key: string, value: boolean) {
    setSavingToggle(key);
    try {
      await setSetting({ key, value });
      toast({ title: value ? "Venda ativada no site" : "Venda desativada no site" });
    } catch {
      toast({ title: "Não foi possível salvar. Tente novamente.", variant: "destructive" });
    } finally {
      setSavingToggle(null);
    }
  }

  async function saveDraft() {
    setIsSaving(true);
    try {
      for (const key of dirtyKeys) {
        await setSetting({ key, value: draft[key]! });
      }
      setDraft({});
      toast({ title: "Alterações salvas" });
    } catch {
      toast({ title: "Não foi possível salvar as alterações. Tente novamente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  const maxDays = current(MAX_DAYS_KEY, 60);
  const closedDays = [...current<string[]>(DISABLED_DAYS_KEY, [])].sort();

  return (
    <>
      <PageShell className="pb-28">
        <Panel>
          <PanelHeader
            title="Vendas no site"
            description="Desligar esconde a opção da página de compra na hora."
            className="pb-2"
          />
          {TOGGLES.map((toggle) => {
            const on = stored(toggle.key, true);
            return (
              <div key={toggle.key} className="flex items-center gap-3 border-t border-border px-5 py-3 first-of-type:border-t-0">
                <label htmlFor={toggle.key} className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{toggle.label}</span>
                  <span className={cn("text-xs", on ? "text-green-700" : "text-muted-foreground")}>
                    {on ? "Ativado — à venda no site" : "Desativado — fora do site"}
                  </span>
                  <LastUpdated setting={byKey.get(toggle.key)} />
                </label>
                <Switch
                  id={toggle.key}
                  checked={on}
                  disabled={savingToggle === toggle.key}
                  onCheckedChange={(value) => void flip(toggle.key, value)}
                  className="h-8 w-[52px] data-[state=checked]:bg-teal-700 [&>span]:size-[26px] [&>span]:data-[state=checked]:translate-x-5"
                />
              </div>
            );
          })}
        </Panel>

        <Panel>
          <PanelHeader
            title="Limite de entradas por voucher"
            description="Quantas pessoas cabem em uma única compra."
            className="pb-2"
          />
          {LIMITS.map((limit) => (
            <div key={limit.key} className="flex items-center gap-3 border-t border-border px-5 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{limit.label}</span>
                <span className="text-xs text-muted-foreground">{limit.sub}</span>
              </div>
              <Stepper
                value={current(limit.key, limit.fallback)}
                min={0}
                max={LIMIT_MAX}
                label={`${limit.label}, ${limit.sub.toLowerCase()}`}
                onChange={(value) => edit(limit.key, value)}
              />
            </div>
          ))}
        </Panel>

        <Panel className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold tracking-tight">Mensagens do site</h2>
            <p className="text-[13px] text-muted-foreground">Deixe em branco para não mostrar nada.</p>
          </div>
          {MESSAGES.map((message) => {
            const value = current(message.key, "");
            return (
              <label key={message.key} className="flex flex-col gap-1.5 text-sm font-medium">
                {message.label}
                <textarea
                  rows={3}
                  maxLength={message.max}
                  value={value}
                  onChange={(event) => edit(message.key, event.target.value.slice(0, message.max))}
                  className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-normal leading-relaxed shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                />
                <span className="self-end text-xs font-normal text-muted-foreground">
                  {value.length}/{message.max}
                </span>
              </label>
            );
          })}
        </Panel>

        <Panel>
          <PanelHeader title="Agendamento" description="Quais datas o cliente pode escolher." className="pb-2" />
          <div className="flex items-center gap-3 px-5 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">Antecedência máxima</span>
              <span className="text-xs text-muted-foreground">Até {maxDays} dias a partir de hoje</span>
            </div>
            <Stepper
              value={maxDays}
              min={1}
              max={365}
              label="dias de antecedência"
              onChange={(value) => edit(MAX_DAYS_KEY, value)}
            />
          </div>
          <div className="flex flex-col gap-3 border-t border-border px-5 pb-5 pt-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Dias fechados</span>
              <span className="text-xs text-muted-foreground">Ninguém consegue comprar para essas datas.</span>
            </div>
            {closedDays.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {closedDays.map((day) => (
                  <span
                    key={day}
                    className="inline-flex h-9 items-center gap-0.5 rounded-full border border-border bg-zinc-50 pl-3 pr-0.5 text-[13px] font-medium"
                  >
                    {format(toDate(day), "d MMM yyyy", { locale: ptBR })}
                    <button
                      type="button"
                      aria-label={`Reabrir ${format(toDate(day), "d 'de' MMMM", { locale: ptBR })}`}
                      onClick={() => edit(DISABLED_DAYS_KEY, closedDays.filter((d) => d !== day))}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 items-center gap-2 self-start rounded-lg border border-dashed border-zinc-300 bg-white px-3.5 text-sm font-medium hover:bg-zinc-50"
                >
                  <Plus className="size-4" aria-hidden />
                  Escolher datas fechadas
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2">
                <MultipleDaysCalendar
                  value={closedDays.map(toDate)}
                  onChange={(dates) => edit(DISABLED_DAYS_KEY, (dates ?? []).map((d) => format(d, DAY_KEY)))}
                />
              </PopoverContent>
            </Popover>
          </div>
        </Panel>
      </PageShell>

      <div className="sticky bottom-0 z-30 border-t border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-5 pt-3">
          <span
            className={cn(
              "flex-1 text-[13px]",
              dirtyKeys.length ? "text-amber-700" : "text-muted-foreground",
            )}
          >
            {dirtyKeys.length ? "Você tem alterações não salvas." : "As chaves de venda salvam na hora."}
          </span>
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={!dirtyKeys.length || isSaving}
            className="h-11 rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-zinc-50 hover:bg-zinc-800 disabled:opacity-45"
          >
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </>
  );
}

function Stepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const button = "flex size-11 items-center justify-center text-foreground transition-colors hover:bg-muted disabled:opacity-40";
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-border bg-white shadow-sm">
      <button type="button" aria-label={`Diminuir ${label}`} className={button} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="w-8 text-center text-base font-semibold" aria-live="polite">
        {value}
      </span>
      <button type="button" aria-label={`Aumentar ${label}`} className={button} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function LastUpdated({ setting }: { setting?: StoredSetting }) {
  if (!setting?.updatedBy || !setting.updatedAt) return null;
  return (
    <span className="text-[11px] text-zinc-400">
      Alterado por {setting.updatedBy} em {new Date(setting.updatedAt).toLocaleDateString("pt-BR")}
    </span>
  );
}
