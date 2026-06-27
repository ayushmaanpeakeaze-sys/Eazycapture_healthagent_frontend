import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: "127.0.0.1",
    strictPort: true,
    proxy: {
      // Django — the real publish/precheck path the production frontend uses.
      "/accounting": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      // FastAPI — direct only for dev dashboards (audit/sweep demos).
      // Production should route these through Django too.
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
      },
    },
  },
});
