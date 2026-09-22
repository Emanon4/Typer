import { createPostService } from "../server/post-service.mjs";

/** @type {ExportedHandler<Env>} */
export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin");
    const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim());
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    });
    if (origin && !allowedOrigins.includes(origin))
      return Response.json({ error: "请从 Typer 页面访问邮局" }, { status: 403, headers });
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      headers.set("Access-Control-Max-Age", "600");
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const store = {
      one: (sql, ...args) => env.DB.prepare(sql).bind(...args).first(),
      all: async (sql, ...args) => (await env.DB.prepare(sql).bind(...args).all()).results,
      run: (sql, ...args) => env.DB.prepare(sql).bind(...args).run(),
    };
    const post = createPostService({ store, allowedOrigins, bearerSessions: true, storage: "cloudflare-d1" });
    const result = await post.handle(request, {
      clientAddress: request.headers.get("CF-Connecting-IP") || "unknown",
    });
    for (const [key, value] of result.headers) headers.set(key, value);
    return new Response(result.body, { status: result.status, headers });
  },
  async scheduled(_event, env) {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM attempts WHERE resets_at<=?").bind(now),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now),
    ]);
  },
};
