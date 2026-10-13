import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "EXPO_PUBLIC_"],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) return "charts";
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) return "firebase";
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) return "react";
        }
      }
    }
  }
});
