"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { updateSetting } from "../actions";
import type { SettingKey } from "@/lib/settings";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface SettingFormProps {
  settingKey: SettingKey; // React reserves `key`, so we must use a different prop name
  value: string | number | boolean | string[] | null;
  label: string;
  description?: string;
  isCurrency?: boolean;
  isDateArray?: boolean;
}

function FormCard({
  children,
  label,
  description,
}: {
  children: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border p-4 pt-2">
      <div className="mb-4 flex flex-col">
        <h3 className="text-lg font-semibold">{label}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Form component for string settings
 */
export function StringSettingForm({
  settingKey,
  value,
  label,
  description,
  isCurrency = false,
}: SettingFormProps) {
  const [inputValue, setInputValue] = useState((value as string) || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  if (isCurrency) {
    alert("isCurrency");
  }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await updateSetting(settingKey, inputValue);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: result.message,
        });
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro inesperado ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormCard label={label} description={description}>
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
                value={inputValue === "0" ? "" : inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setInputValue(value === "" ? "0" : value);
                }}
                placeholder="0,00"
                disabled={isLoading}
                className="pl-10"
              />
            </div>
          ) : (
            <Textarea
              id={settingKey}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite o valor..."
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
 * Form component for number settings
 */
export function NumberSettingForm({
  settingKey,
  value,
  label,
  description,
  isCurrency = false,
}: SettingFormProps) {
  const [inputValue, setInputValue] = useState((value as number) || 0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await updateSetting(settingKey, inputValue);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: result.message,
        });
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro inesperado ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormCard label={label} description={description}>
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
 * Form component for boolean settings
 */
export function BooleanSettingForm({
  settingKey,
  value,
  label,
  description,
}: SettingFormProps) {
  const [inputValue, setInputValue] = useState((value as boolean) || false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await updateSetting(settingKey, inputValue);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: result.message,
        });
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro inesperado ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormCard label={label} description={description}>
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
 * Form component for JSON settings
 */
export function JsonSettingForm({
  settingKey,
  value,
  label,
  description,
  isDateArray = false,
}: SettingFormProps) {
  const [inputValue, setInputValue] = useState(
    value ? JSON.stringify(value, null, 2) : "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const { toast } = useToast();

  const validateJson = (jsonString: string) => {
    try {
      JSON.parse(jsonString);
      setJsonError(null);
      return true;
    } catch (error) {
      setJsonError("JSON inválido");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateJson(inputValue)) {
      toast({
        title: "Erro",
        description: "JSON inválido. Verifique a sintaxe.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const parsedValue = JSON.parse(inputValue) as Record<string, unknown>;
      const result = await updateSetting(settingKey, parsedValue);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: result.message,
        });
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro inesperado ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <FormCard label={label} description={description}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={settingKey}>Valor JSON</Label>
          <textarea
            id={settingKey}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              validateJson(e.target.value);
            }}
            placeholder='{"chave": "valor"}'
            disabled={isLoading}
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            rows={6}
          />
          {jsonError && <p className="text-sm text-red-500">{jsonError}</p>}
        </div>
        <Button
          className="float-right"
          type="submit"
          disabled={isLoading || !!jsonError}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </form>
    </FormCard>
  );
}
