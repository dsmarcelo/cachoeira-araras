"use server";

import { getSetting, setSetting, type SettingKey, getAllSettings as getSettingsDAL } from "@/lib/settings";
import { revalidatePath } from "next/cache";

/**
 * Server action to get all current settings
 * Uses the DAL (Data Access Layer) function to fetch all settings at once
 */
export async function getAllSettings() {
  const allSettings = await getSettingsDAL();
  
  // Convert SettingValueMap to array of key-value pairs for the page component
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
    "enable.voucher.half-price.buy",
    "enable.voucher.half-price.pool.buy",
  ];

  return settingKeys.map((key) => ({
    key,
    value: allSettings[key],
  }));
}

/**
 * Server action to update a setting value
 */
export async function updateSetting(
  key: SettingKey,
  value: string | number | boolean | string[] | Record<string, unknown>,
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
