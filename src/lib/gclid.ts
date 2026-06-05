const gclidCookieName = "gclid";
const maxGclidLength = 255;
const gclidCookieDays = 90;

export function normalizeGclid(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue || normalizedValue.length > maxGclidLength) {
    return null;
  }

  return normalizedValue;
}

export function readGclidCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${gclidCookieName}=`));

  if (!cookie) {
    return null;
  }

  const [, value] = cookie.split("=", 2);

  try {
    return normalizeGclid(decodeURIComponent(value ?? ""));
  } catch {
    return null;
  }
}

export function storeGclidCookie(value: string | null | undefined): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const gclid = normalizeGclid(value);
  if (!gclid) {
    return null;
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + gclidCookieDays);

  document.cookie = [
    `${gclidCookieName}=${encodeURIComponent(gclid)}`,
    "path=/",
    `expires=${expires.toUTCString()}`,
    "SameSite=Lax",
  ].join("; ");

  return gclid;
}
