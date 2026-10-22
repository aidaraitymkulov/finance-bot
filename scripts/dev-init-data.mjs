// Signs Telegram Mini App initData for local development in a regular browser (outside Telegram),
// using TELEGRAM_BOT_TOKEN and ALLOWED_TELEGRAM_USER_ID from the backend env files.
// Used by the Vite dev server (webapp/vite.config.ts), which hands it out only to localhost.
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Same precedence as the app in development: the first file that defines a key wins. */
const readEnv = () => {
  const env = {};
  for (const file of [".env.development", ".env"]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !(match[1] in env)) env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
  return env;
};

export const createDevInitData = () => {
  const { TELEGRAM_BOT_TOKEN: token, ALLOWED_TELEGRAM_USER_ID: userId } = readEnv();
  if (!token || !userId) {
    throw new Error("TELEGRAM_BOT_TOKEN and ALLOWED_TELEGRAM_USER_ID are required");
  }

  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: Number(userId), first_name: "Dev" }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
};
