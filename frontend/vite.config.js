import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        pricing: resolve(import.meta.dirname, "pricing.html"),
        docs: resolve(import.meta.dirname, "docs.html"),
        trust: resolve(import.meta.dirname, "trust.html"),
        terms: resolve(import.meta.dirname, "terms.html"),
        privacy: resolve(import.meta.dirname, "privacy.html"),
        refundPolicy: resolve(import.meta.dirname, "refund-policy.html"),
        shippingPolicy: resolve(import.meta.dirname, "shipping-policy.html"),
        contact: resolve(import.meta.dirname, "contact.html"),
      },
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          qr: ["qrcode.react"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
