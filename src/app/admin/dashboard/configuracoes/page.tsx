import { getAllSettings } from "./actions";
import {
  StringSettingForm,
  NumberSettingForm,
  BooleanSettingForm,
  JsonSettingForm,
} from "./_components/setting-form";
import { Toaster } from "@/components/ui/toaster";

// Mapping of setting keys to their display information
const SETTING_CONFIG = {
  "voucher.price": {
    label: "Preço do Voucher",
    description: "Preço base para vouchers normais",
    type: "number" as const,
    isCurrency: true,
  },
  "voucher.pool.price": {
    label: "Preço do Voucher Piscina",
    description: "Preço base para vouchers com acesso à piscina",
    type: "number" as const,
    isCurrency: true,
  },
  "voucher.max.quantity.adults": {
    label: "Máximo de Adultos - Voucher Normal",
    description: "Número máximo de adultos permitidos em vouchers normais",
    type: "number" as const,
  },
  "voucher.max.quantity.elderly": {
    label: "Máximo de Entradas Meias - Voucher Normal",
    description:
      "Número máximo de entradas meias permitidas em vouchers normais",
    type: "number" as const,
  },
  "voucher.max.quantity.adults.pool": {
    label: "Máximo de Adultos - Voucher Piscina",
    description: "Número máximo de adultos permitidos em vouchers com piscina",
    type: "number" as const,
  },
  "voucher.max.quantity.elderly.pool": {
    label: "Máximo de Entradas Meias - Voucher Piscina",
    description:
      "Número máximo de entradas meias permitidas em vouchers com piscina",
    type: "number" as const,
  },
  "enable.voucher.buy": {
    label: "Habilitar Compra de Vouchers",
    description: "Permitir ou não a compra de vouchers normais",
    type: "boolean" as const,
  },
  "enable.voucher.pool.buy": {
    label: "Habilitar Compra de Vouchers Piscina",
    description: "Permitir ou não a compra de vouchers com acesso à piscina",
    type: "boolean" as const,
  },
  "enable.voucher.half-price.buy": {
    label: "Habilitar Compra de Vouchers Meia Entrada",
    description: "Permitir ou não a compra de vouchers com preço de meia entrada",
    type: "boolean" as const,
  },
  "enable.voucher.half-price.pool.buy": {
    label: "Habilitar Compra de Vouchers Meia Entrada Piscina",
    description: "Permitir ou não a compra de vouchers com acesso à piscina e preço de meia entrada",
    type: "boolean" as const,
  },
  "top.message": {
    label: "Mensagem Superior",
    description: "Mensagem exibida no topo do site",
    type: "string" as const,
  },
  "form.message": {
    label: "Mensagem do Formulário",
    description: "Mensagem exibida no formulário de compra",
    type: "string" as const,
  },
  "max.intended.days": {
    label: "Máximo de Dias para Agendamento",
    description: "Número máximo de dias para agendamento de vouchers",
    type: "number" as const,
  },
  "disabled.days": {
    label: "Dias Desabilitados",
    description:
      "Lista de datas desabilitadas para agendamento (formato JSON array)",
    type: "json" as const,
    isDateArray: true,
  },
} as const satisfies Record<
  string,
  {
    label: string;
    description: string;
    type: "string" | "number" | "boolean" | "json";
    isCurrency?: boolean;
    isDateArray?: boolean;
  }
>;

export default async function ConfiguracoesPage() {
  const settings = await getAllSettings();

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Configurações do Site</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do site
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settings.map(({ key, value }) => {
          const config = SETTING_CONFIG[key];
          if (!config) return null;

          const commonProps = {
            settingKey: key,
            value: value,
            label: config.label,
            description: config.description,
            isCurrency: "isCurrency" in config ? config.isCurrency : false,
            isDateArray: "isDateArray" in config ? config.isDateArray : false,
          };

          switch (config.type) {
            case "string":
              return <StringSettingForm key={key} {...commonProps} />;
            case "number":
              return <NumberSettingForm key={key} {...commonProps} />;
            case "boolean":
              return <BooleanSettingForm key={key} {...commonProps} />;
            case "json":
              return <JsonSettingForm key={key} {...commonProps} />;
            default:
              return null;
          }
        })}
      </div>

      <Toaster />
    </div>
  );
}
