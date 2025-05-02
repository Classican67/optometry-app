import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import vuetify from "vite-plugin-vuetify";

export default defineConfig({
  plugins: [vue(), vuetify()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["src/test/setup.js"],
    deps: {
      inline: ["vuetify"],
    },
    css: true,
  },
});
