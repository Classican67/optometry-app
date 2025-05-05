import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
  },
  base: "/optometry-app/",
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
