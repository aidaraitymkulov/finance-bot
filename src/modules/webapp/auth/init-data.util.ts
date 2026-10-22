import { createHmac, timingSafeEqual } from "node:crypto";

export interface InitDataUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/** How long a Mini App launch stays valid (Telegram signs `auth_date` at launch). */
export const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

/** `key=value` pairs (except `hash`) sorted by key and joined with "\n". */
const buildDataCheckString = (params: URLSearchParams) =>
  [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

export const signInitData = (params: URLSearchParams, botToken: string): string => {
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secretKey).update(buildDataCheckString(params)).digest("hex");
};

/**
 * Validates Telegram Mini App `initData` (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
 * and returns the user, or null if the signature is wrong, the data is stale or has no user.
 */
export const validateInitData = (
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = INIT_DATA_MAX_AGE_SECONDS,
): InitDataUser | null => {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
    return null;
  }

  const expected = Buffer.from(signInitData(params, botToken), "hex");
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) {
    return null;
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || nowSeconds - authDate > maxAgeSeconds) {
    return null;
  }

  try {
    const user = JSON.parse(params.get("user") ?? "null") as InitDataUser | null;
    return user && typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
};
