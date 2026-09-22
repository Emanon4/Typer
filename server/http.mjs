export function apiMiddleware(service) {
  return async (req, res, next) => {
    if (!req.url.startsWith("/api/")) {
      next?.();
      return;
    }
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 250000) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "信件过长" }));
          return;
        }
        chunks.push(chunk);
      }
      const origin =
        process.env.TYPER_PUBLIC_ORIGIN || `http://${req.headers.host}`;
      const request = new Request(new URL(req.url, origin), {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: Buffer.concat(chunks) }
          : {}),
      });
      const response = await service.handle(request, {
        clientAddress: req.socket.remoteAddress,
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "邮局暂时不可用" }));
    }
  };
}
