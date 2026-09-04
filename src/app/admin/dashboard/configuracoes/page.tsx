"use client";

import { useMutation, useQuery } from "convex/react";

import { api } from "../../../../../convex/_generated/api";
import {
  StringSettingForm,
  NumberSettingForm,
  BooleanSettingForm,
  DisabledDaysSettingForm,
} from "./_components/setting-form";
import { Toaster } from "@/components/ui/toaster";

// Display metadata and defaults for each setting key. Prices are entered by
// the admin in reais but stored (and defaulted here) in cents, matching
// vouchers.priceCents; the form components handle the reais<->cents
// conversion at the boundary.
const SETTING_CONFIG = {
  "voucher.price": {
    label: "Preço do Voucher",
    description: "Preço base para vouchers normais",
    type: "number" as const,
    isCurrency: true,
    defaultValue: 5000,
  },
  "voucher.pool.price": {
    label: "Preço do Voucher Piscina",
    description: "Preço base para vouchers com acesso à piscina",
    type: "number" as const,
    isCurrency: true,
    defaultValue: 7000,
  },
  "voucher.max.quantity.adults": {
    label: "Máximo de Adultos - Voucher Normal",
    description: "Número máximo de adultos permitidos em vouchers normais",
    type: "number" as const,
    defaultValue: 20,
  },
  "voucher.max.quantity.elderly": {
    label: "Máximo de Entradas Meias - Voucher Normal",
    description:
      "Número máximo de entradas meias permitidas em vouchers normais",
    type: "number" as const,
    defaultValue: 20,
  },
  "voucher.max.quantity.adults.pool": {
    label: "Máximo de Adultos - Voucher Piscina",
    description:
      "Número máximo de adultos permitidos em vouchers com piscina",
    type: "number" as const,
    defaultValue: 20,
  },
  "voucher.max.quantity.elderly.pool": {
    label: "Máximo de Entradas Meias - Voucher Piscina",
    description:
      "Número máximo de entradas meias permitidas em vouchers com piscina",
    type: "number" as const,
    defaultValue: 20,
  },
  "enable.voucher.buy": {
    label: "Habilitar Compra de Vouchers",
    description: "Permitir ou não a compra de vouchers normais",
    type: "boolean" as const,
    defaultValue: true,
  },
  "enable.voucher.pool.buy": {
    label: "Habilitar Compra de Vouchers Piscina",
    description: "Permitir ou não a compra de vouchers com acesso à piscina",
    type: "boolean" as const,
    defaultValue: true,
  },
  "enable.voucher.half-price.buy": {
    label: "Habilitar Compra de Vouchers Meia Entrada",
    description:
      "Permitir ou não a compra de vouchers com preço de meia entrada",
    type: "boolean" as const,
    defaultValue: true,
  },
  "enable.voucher.half-price.pool.buy": {
    label: "Habilitar Compra de Vouchers Meia Entrada Piscina",
    description:
      "Permitir ou não a compra de vouchers com acesso à piscina e preço de meia entrada",
    type: "boolean" as const,
    defaultValue: true,
  },
  "top.message": {
    label: "Mensagem Superior",
    description: "Mensagem exibida no topo do site",
    type: "string" as const,
    defaultValue: "",
  },
  "form.message": {
    label: "Mensagem do Formulário",
    description: "Mensagem exibida no formulário de compra",
    type: "string" as const,
    defaultValue: "",
  },
  "max.intended.days": {
    label: "Máximo de Dias para Agendamento",
    description: "Número máximo de dias para agendamento de vouchers",
    type: "number" as const,
    defaultValue: 60,
  },
  "disabled.days": {
    label: "Dias Desabilitados",
    description: "Datas desabilitadas para agendamento",
    type: "disabledDays" as const,
    defaultValue: [] as string[],
  },
} as const satisfies Record<
  string,
  {
    label: string;
    description: string;
    type: "string" | "number" | "boolean" | "disabledDays";
    isCurrency?: boolean;
    defaultValue: number | string | boolean | string[];
  }
>;

type SettingKey = keyof typeof SETTING_CONFIG;

export default function ConfiguracoesPage() {
  const settings = useQuery(api.settings.list);
  const setSetting = useMutation(api.settings.set);

  const settingsByKey = new Map(settings?.map((s) => [s.key, s]));

  if (settings === undefined) {
    return (
      <div className="container mx-auto space-y-8 p-6">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Configurações do Site</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do site. As alterações valem para os
          visitantes imediatamente, sem precisar recarregar a página.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(SETTING_CONFIG) as SettingKey[]).map((key) => {
          const config = SETTING_CONFIG[key];
          const stored = settingsByKey.get(key);

          switch (config.type) {
            case "string":
              return (
                <StringSettingForm
                  key={key}
                  settingKey={key}
                  value={(stored?.value as string) ?? config.defaultValue}
                  label={config.label}
                  description={config.description}
                  onSave={async (value) => {
                    await setSetting({ key, value });
                  }}
                  updatedBy={stored?.updatedBy}
                  updatedAt={stored?.updatedAt}
                />
              );
            case "number":
              return (
                <NumberSettingForm
                  key={key}
                  settingKey={key}
                  value={(stored?.value as number) ?? config.defaultValue}
                  label={config.label}
                  description={config.description}
                  isCurrency={"isCurrency" in config && config.isCurrency}
                  onSave={async (value) => {
                    await setSetting({ key, value });
                  }}
                  updatedBy={stored?.updatedBy}
                  updatedAt={stored?.updatedAt}
                />
              );
            case "boolean":
              return (
                <BooleanSettingForm
                  key={key}
                  settingKey={key}
                  value={(stored?.value as boolean) ?? config.defaultValue}
                  label={config.label}
                  description={config.description}
                  onSave={async (value) => {
                    await setSetting({ key, value });
                  }}
                  updatedBy={stored?.updatedBy}
                  updatedAt={stored?.updatedAt}
                />
              );
            case "disabledDays":
              return (
                <DisabledDaysSettingForm
                  key={key}
                  settingKey={key}
                  value={(stored?.value as string[]) ?? config.defaultValue}
                  label={config.label}
                  description={config.description}
                  onSave={async (value) => {
                    await setSetting({ key, value });
                  }}
                  updatedBy={stored?.updatedBy}
                  updatedAt={stored?.updatedAt}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      <Toaster />
    </div>
  );
}
