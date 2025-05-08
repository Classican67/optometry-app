import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
  },
  base: "/optometryDB/",
  plugins: [vue()],
  optimizeDeps: {
    include: ["pdfjs-dist/build/pdf.worker.mjs", "rgbcolor", "raf"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    commonjsOptions: {
      include: [/pdfjs-dist/, /rgbcolor/, /raf/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: ["rgbcolor"],
      output: {
        globals: {
          rgbcolor: "RGBColor",
        },
      },
    },
  },
  resolve: {
    alias: {
      raf: "raf/index.js",
    },
  },
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
