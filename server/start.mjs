import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createPostOffice } from "./post-office.mjs";
import { apiMiddleware } from "./http.mjs";
const root = resolve("dist/client"),
  office = createPostOffice({
    filename: process.env.TYPER_POST_DB || ".typer-data/post.sqlite",
  }),
  api = apiMiddleware(office);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wav": "audio/wav",
};
const server = createServer((req, res) =>
  api(req, res, async () => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const path = decodeURIComponent(
          new URL(req.url, "http://local").pathname,
        ),
        file = resolve(root, "." + path);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      let target = file;
      try {
        if (!(await stat(target)).isFile())
          target = resolve(root, "index.html");
      } catch {
        if (!extname(path)) target = resolve(root, "index.html");
        else throw Error("missing");
      }
      const bytes = await readFile(target);
      res.writeHead(200, {
        "Content-Type": types[extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }),
);
const port = Number(process.env.PORT || 8787),
  host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () =>
  console.log(`Typer + Post: http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      office.close();
      process.exit(0);
    }),
  );
