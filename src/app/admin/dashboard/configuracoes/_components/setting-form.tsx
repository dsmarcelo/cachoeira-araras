"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import MultipleDaysCalendar from "@/components/ui/multiple-days-calendar";

/**
 * Each form owns its own input state and hands the parsed value to `onSave`,
 * which the settings page wires to the `settings.set` Convex mutation. Save
 * failures (network error, or the mutation's own admin check rejecting a
 * session that just expired) surface as a toast; nothing here talks to
 * Convex directly, so these stay easy to reuse or test in isolation.
 */
interface SettingFormProps<T> {
  settingKey: string; // React reserves `key`, so we must use a different prop name
  value: T;
  label: string;
  description?: string;
  onSave: (value: T) => Promise<void>;
  updatedBy?: string;
  updatedAt?: number;
}

function LastUpdated({
  updatedBy,
  updatedAt,
}: {
  updatedBy?: string;
  updatedAt?: number;
}) {
  if (!updatedBy || !updatedAt) return null;

  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Última alteração por {updatedBy} em{" "}
      {new Date(updatedAt).toLocaleString("pt-BR")}
    </p>
  );
}

function FormCard({
  children,
  label,
  description,
  updatedBy,
  updatedAt,
}: {
  children: React.ReactNode;
  label: string;
  description?: string;
  updatedBy?: string;
  updatedAt?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground p-4 pt-2">
      <div className="mb-4 flex flex-col">
        <h3 className="text-lg font-semibold">{label}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
      <LastUpdated updatedBy={updatedBy} updatedAt={updatedAt} />
    </div>
  );
}

async function runSave(
  save: () => Promise<void>,
  toast: ReturnType<typeof useToast>["toast"],
  setIsLoading: (loading: boolean) => void,
) {
  setIsLoading(true);
  try {
    await save();
    toast({
      title: "Sucesso",
      description: "Configuração atualizada com sucesso!",
    });
  } catch {
    toast({
      title: "Erro",
      description: "Erro ao atualizar configuração. Tente novamente.",
      variant: "destructive",
    });
  } finally {
    setIsLoading(false);
  }
}

/**
 * Form component for free-text settings (banner messages).
 */
export function StringSettingForm({
  settingKey,
  value,
  label,
  description,
  onSave,
  updatedBy,
  updatedAt,
}: SettingFormProps<string>) {
  const [inputValue, setInputValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSave(() => onSave(inputValue), toast, setIsLoading);
  };

  return (
    <FormCard
      label={label}
      description={description}
      updatedBy={updatedBy}
      updatedAt={updatedAt}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          id={settingKey}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Digite o valor..."
          disabled={isLoading}
        />
        <Button className="float-right" type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>
    </FormCard>
  );
}

/**
 * Form component for number settings. `isCurrency` inputs are entered in
 * reais and converted to integer cents on save (`onSave` receives cents);
 * `value` is likewise expected in cents and is divided back down for
 * display, so storage is always cents per the settings vocabulary.
 */
export function NumberSettingForm({
  settingKey,
  value,
  label,
  description,
  isCurrency = false,
  onSave,
  updatedBy,
  updatedAt,
}: SettingFormProps<number> & { isCurrency?: boolean }) {
  const initialReais = isCurrency ? value / 100 : value;
  const [inputValue, setInputValue] = useState(initialReais);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toSave = isCurrency ? Math.round(inputValue * 100) : inputValue;
    await runSave(() => onSave(toSave), toast, setIsLoading);
  };

  return (
    <FormCard
      label={label}
      description={description}
      updatedBy={updatedBy}
      updatedAt={updatedAt}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          {isCurrency ? (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </div>
              <Input
                id={settingKey}
                type="number"
                step="0.01"
                value={inputValue === 0 ? "" : inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setInputValue(value === "" ? 0 : Number(value));
                }}
                placeholder="0,00"
                disabled={isLoading}
                className="pl-10"
              />
            </div>
          ) : (
            <Input
              id={settingKey}
              type="number"
              value={inputValue === 0 ? "" : inputValue}
              onChange={(e) => {
                const value = e.target.value;
                setInputValue(value === "" ? 0 : Number(value));
              }}
              placeholder="Digite o valor numérico..."
              disabled={isLoading}
            />
          )}
        </div>
        <Button className="float-right" type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>
    </FormCard>
  );
}

/**
 * Form component for boolean settings.
 */
export function BooleanSettingForm({
  settingKey,
  value,
  label,
  description,
  onSave,
  updatedBy,
  updatedAt,
}: SettingFormProps<boolean>) {
  const [inputValue, setInputValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSave(() => onSave(inputValue), toast, setIsLoading);
  };

  return (
    <FormCard
      label={label}
      description={description}
      updatedBy={updatedBy}
      updatedAt={updatedAt}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id={settingKey}
            checked={inputValue}
            onCheckedChange={(checked) => setInputValue(checked)}
            disabled={isLoading}
          />
          <Label
            htmlFor={settingKey}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {inputValue ? "Ativado" : "Desativado"}
          </Label>
        </div>
        <Button className="float-right" type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>
    </FormCard>
  );
}

/**
 * Form component for the disabled-days setting: a calendar of ISO
 * ("YYYY-MM-DD") date strings.
 */
export function DisabledDaysSettingForm({
  value,
  label,
  description,
  onSave,
  updatedBy,
  updatedAt,
}: SettingFormProps<string[]>) {
  const initialDates = value
    .map((dateStr) => {
      // Parse date string as local date to avoid timezone issues
      const parts = dateStr.split("-").map(Number);
      if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        return null;
      }
      const [year, month, day] = parts as [number, number, number];
      return new Date(year, month - 1, day); // month is 0-indexed
    })
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));
  const [selectedDates, setSelectedDates] = useState<Date[] | undefined>(
    initialDates,
  );
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isoDates = (selectedDates ?? []).map((d) => {
      // Format as YYYY-MM-DD using local date to avoid timezone issues
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    });
    await runSave(() => onSave(isoDates), toast, setIsLoading);
  };

  return (
    <FormCard
      label={label}
      description={description}
      updatedBy={updatedBy}
      updatedAt={updatedAt}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Selecione os dias</Label>
          <MultipleDaysCalendar
            value={selectedDates}
            onChange={setSelectedDates}
            disabled={isLoading}
          />
        </div>
        <Button className="float-right" type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>
    </FormCard>
  );
}
