import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served from https://akshat1404.github.io/Openbundle/ — a project-repo
  // subpath, not the domain root — so every built asset reference must be
  // prefixed accordingly.
  base: "/Openbundle/",
  plugins: [react()],
  server: {
    // fixtures/ lives at the repo root, one level above this workspace.
    fs: { allow: [".."] },
  },
});
