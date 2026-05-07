import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = process.env.TALES_PORT ?? "5174";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": `http://127.0.0.1:${SERVER_PORT}`,
    },
  },
});
