import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer"; // Import the visualizer plugin

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }), // Add the visualizer plugin
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split vendor libraries into a separate chunk
          if (id.includes("node_modules")) {
            return "vendor";
          }
          // Split specific components or libraries if necessary
          if (id.includes("src/components")) {
            return "components";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase the chunk size warning limit
  },
});
