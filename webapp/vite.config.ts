import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error plain JS helper shared with the backend repo root
import { createDevInitData } from "../scripts/dev-init-data.mjs";

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * GET /__dev-init-data: signed initData for opening the app in a regular browser. Served only
 * to direct localhost requests — never through a tunnel (cloudflared sets its own Host and
 * Cf-Connecting-Ip), since it grants access to the owner's data.
 */
const devInitData = (): Plugin => ({
  name: "dev-init-data",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/__dev-init-data", (req, res) => {
      const isLocal =
        LOCAL_HOSTS.test(req.headers.host ?? "") &&
        !req.headers["cf-connecting-ip"] &&
        !req.headers["x-forwarded-for"];
      if (!isLocal) {
        res.statusCode = 403;
        res.end();
        return;
      }
      res.setHeader("Content-Type", "text/plain");
      res.end(createDevInitData());
    });
  },
});

// In dev the Vite server proxies /api to the Nest backend (BACKEND_URL, default localhost:3001).
// To open the dev build inside Telegram, tunnel it: cloudflared tunnel --url http://localhost:5173
export default defineConfig({
  plugins: [react(), devInitData()],
  server: {
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": process.env.BACKEND_URL ?? "http://localhost:3001",
    },
  },
});
