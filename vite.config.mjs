import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createPostOffice } from "./server/post-office.mjs";
import { apiMiddleware } from "./server/http.mjs";

export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/Typer/" : "/",
  build: {
    outDir: mode === "pages" ? "dist/pages" : "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(),{
    name:"typer-local-post-office",
    configureServer(server) {
      const office=createPostOffice({filename:process.env.TYPER_POST_DB||".typer-data/post.sqlite"});
      server.middlewares.use(apiMiddleware(office));
      server.httpServer?.once("close",()=>office.close());
    },
  }],
}));
