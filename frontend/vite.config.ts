import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// /api 요청은 로컬 서버(8080, backend/.env의 PORT)로 프록시 → 클라이언트 코드에서는 항상 "/api"만 쓴다
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
