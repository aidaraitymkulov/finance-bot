export const Configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    allowedUserId: process.env.ALLOWED_TELEGRAM_USER_ID
      ? Number(process.env.ALLOWED_TELEGRAM_USER_ID)
      : undefined,
    /** Public https URL of the Mini App; when set, it becomes the bot's menu button. */
    webAppUrl: process.env.WEBAPP_URL || undefined,
  },
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    synchronize: process.env.DB_SYNCHRONIZE === "true",
  },
});
