"use server";

import { getSetting, setSetting, type SettingKey } from "@/lib/settings";
import { revalidatePath } from "next/cache";

/**
 * Server action to get all current settings
 */

// Change the order here
export async function getAllSettings() {
  const settingKeys: SettingKey[] = [
    "voucher.price",
    "voucher.pool.price",
    "voucher.max.quantity.adults",
    "voucher.max.quantity.elderly",
    "voucher.max.quantity.adults.pool",
    "voucher.max.quantity.elderly.pool",
    "top.message",
    "form.message",
    "max.intended.days",
    "disabled.days",
    "enable.voucher.buy",
    "enable.voucher.pool.buy",
  ];

  const settings = await Promise.all(
    settingKeys.map(async (key) => {
      const value = await getSetting(key);
      return { key, value };
    }),
  );

  return settings;
}

/**
 * Server action to update a setting value
 */
export async function updateSetting(
  key: SettingKey,
  value: string | number | boolean | Record<string, unknown>,
  updatedBy?: string,
) {
  try {
    await setSetting(key, value, { updatedBy });
    revalidatePath("/admin/dashboard/configuracoes");
    return { success: true, message: "Configuração atualizada com sucesso!" };
  } catch (error) {
    console.error("Error updating setting:", error);
    return {
      success: false,
      message: "Erro ao atualizar configuração. Tente novamente.",
    };
  }
}

/**
 * Server action to get a specific setting value
 */
export async function getSettingValue(key: SettingKey) {
  try {
    const value = await getSetting(key);
    return { success: true, value };
  } catch (error) {
    console.error("Error getting setting:", error);
    return { success: false, value: null };
  }
}
