import "server-only";

import { env } from "@/env";

const googleAdsApiVersion = "v24";
const googleOAuthTokenUrl = "https://oauth2.googleapis.com/token";
const googleAdsApiBaseUrl = `https://googleads.googleapis.com/${googleAdsApiVersion}`;

interface GoogleAdsOfflineConversionInput {
  gclid: string;
  value: number;
  currencyCode: string;
  conversionDate: Date | string;
  orderId: string;
}

interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken: string;
  customerId: string;
  conversionActionId: string;
  loginCustomerId?: string;
}

interface GoogleOAuthTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleAdsUploadResponse {
  partialFailureError?: unknown;
}

export type GoogleAdsOfflineConversionResult =
  | {
      status: "sent";
    }
  | {
      status: "skipped";
      reason: "missing_config";
    };

export async function sendGoogleAdsOfflineConversion({
  gclid,
  value,
  currencyCode,
  conversionDate,
  orderId,
}: GoogleAdsOfflineConversionInput): Promise<GoogleAdsOfflineConversionResult> {
  const config = getGoogleAdsConfig();
  if (!config) {
    return {
      status: "skipped",
      reason: "missing_config",
    };
  }

  const conversionValue = normalizeConversionValue(value);
  const accessToken = await fetchGoogleAdsAccessToken(config);
  const conversionAction = `customers/${config.customerId}/conversionActions/${config.conversionActionId}`;
  const response = await fetch(
    `${googleAdsApiBaseUrl}/customers/${config.customerId}:uploadClickConversions`,
    {
      method: "POST",
      headers: buildGoogleAdsHeaders(config, accessToken),
      body: JSON.stringify({
        conversions: [
          {
            conversionAction,
            gclid,
            conversionDateTime: formatGoogleAdsDateTime(conversionDate),
            conversionValue,
            currencyCode,
            orderId,
          },
        ],
        partialFailure: true,
      }),
    },
  );

  const payload = (await readJsonResponse(response)) as GoogleAdsUploadResponse;
  if (!response.ok) {
    throw new Error(
      `Google Ads upload failed with ${response.status}: ${stringifyErrorPayload(payload)}`,
    );
  }

  if (payload.partialFailureError) {
    throw new Error(
      `Google Ads upload partial failure: ${stringifyErrorPayload(payload.partialFailureError)}`,
    );
  }

  return {
    status: "sent",
  };
}

export function formatGoogleAdsDateTime(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid Google Ads conversion date");
  }

  return [
    `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`,
    `${padDatePart(date.getUTCHours())}:${padDatePart(date.getUTCMinutes())}:${padDatePart(date.getUTCSeconds())}+00:00`,
  ].join(" ");
}

function getGoogleAdsConfig(): GoogleAdsConfig | null {
  const config = {
    clientId: env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: env.GOOGLE_ADS_CLIENT_SECRET,
    developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN,
    refreshToken: env.GOOGLE_ADS_REFRESH_TOKEN,
    customerId: normalizeGoogleAdsId(env.GOOGLE_ADS_CUSTOMER_ID),
    conversionActionId: normalizeGoogleAdsId(env.GOOGLE_ADS_CONVERSION_ACTION_ID),
    loginCustomerId: normalizeGoogleAdsId(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID),
  };

  if (
    !config.clientId ||
    !config.clientSecret ||
    !config.developerToken ||
    !config.refreshToken ||
    !config.customerId ||
    !config.conversionActionId
  ) {
    return null;
  }

  return {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    developerToken: config.developerToken,
    refreshToken: config.refreshToken,
    customerId: config.customerId,
    conversionActionId: config.conversionActionId,
    loginCustomerId: config.loginCustomerId,
  };
}

async function fetchGoogleAdsAccessToken(config: GoogleAdsConfig): Promise<string> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(googleOAuthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const payload = (await readJsonResponse(response)) as GoogleOAuthTokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `Google OAuth refresh failed with ${response.status}: ${stringifyErrorPayload(payload)}`,
    );
  }

  return payload.access_token;
}

function buildGoogleAdsHeaders(
  config: GoogleAdsConfig,
  accessToken: string,
): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": config.developerToken,
  };

  if (config.loginCustomerId) {
    headers["login-customer-id"] = config.loginCustomerId;
  }

  return headers;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function normalizeGoogleAdsId(value: string | undefined): string | undefined {
  const normalizedValue = value?.replaceAll("-", "").trim();
  if (!normalizedValue) {
    return undefined;
  }

  return normalizedValue;
}

function normalizeConversionValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Google Ads conversion value must be greater than zero");
  }

  return Number(value.toFixed(2));
}

function stringifyErrorPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}
