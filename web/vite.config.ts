import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // fixtures/ lives at the repo root, one level above this workspace.
    fs: { allow: [".."] },
  },
});
