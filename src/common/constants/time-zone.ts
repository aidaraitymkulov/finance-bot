export const APP_TIME_ZONE = "Asia/Bishkek";

// Cron jobs and all "local date" calculations (today, streaks, task due dates) rely on this.
process.env.TZ = APP_TIME_ZONE;
