import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { getPaperLayout } from "../src/referenceGeometry.js";
import { PAPER_TEMPLATES } from "../src/paperTemplates.js";

const derive = promisify(scrypt),
  DAY = 86400000,
  SESSION_LIFE = 14 * DAY;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const handleOf = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/@typer$/, " ")
    .trim();
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
async function passwordHash(password, salt) {
  return derive(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

function letterSnapshot(input) {
  const model = input?.model;
  if (
    !model ||
    !Array.isArray(model.lines) ||
    !model.lines.length ||
    model.kind !== "letter"
  )
    throw fail("请使用信笺寄出一封完整的信");
  if (!["reference", "compact"].includes(model.layoutId))
    throw fail("未识别的信笺排版");
  const layout = getPaperLayout(model);
  if (model.lines.length > layout.maxLines) throw fail("信笺超过一张纸的容量");
  let count = 0;
  const lines = model.lines.map((row, index) => {
    if (!row || !Array.isArray(row.glyphs) || row.glyphs.length > 200)
      throw fail("信笺字迹数据无效");
    const glyphs = row.glyphs.map((g, i) => {
      if (
        !g ||
        typeof g.character !== "string" ||
        g.character.length > 24 ||
        !Number.isFinite(g.x) ||
        g.x < 0 ||
        g.x > layout.maxUnits ||
        !Number.isFinite(g.seed) ||
        !Number.isFinite(g.units) ||
        g.units <= 0 ||
        g.units > 2
      )
        throw fail("信笺字迹数据无效");
      if (g.character.trim()) count++;
      return {
        id: `${index}-${i}`,
        character: g.character,
        x: g.x,
        units: g.units,
        seed: g.seed,
      };
    });
    return {
      glyphs,
      cursor: Math.max(0, Math.min(layout.maxUnits, Number(row.cursor) || 0)),
    };
  });
  if (!count) throw fail("信笺还是空白的，先写几句话吧");
  if (!PAPER_TEMPLATES.some((p) => p.id === input.paperId))
    throw fail("未识别的信笺");
  if (!["road", "swallow"].includes(input.stampId)) throw fail("请选一枚邮票");
  return {
    paperId: input.paperId,
    stampId: input.stampId,
    model: {
      kind: "letter",
      layoutId: layout.id,
      activeLine: lines.length - 1,
      pageFull: false,
      lines,
    },
  };
}

export function createPostOffice({
  filename = ".typer-data/post.sqlite",
  clock = Date.now,
} = {}) {
  if (filename !== ":memory:")
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ":memory:") chmodSync(filename, 0o600);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,handle TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,timezone TEXT NOT NULL,daily_limit INTEGER NOT NULL DEFAULT 3,min_hours INTEGER NOT NULL DEFAULT 24,accept_mail INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS letters(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,snapshot TEXT NOT NULL,created_at INTEGER NOT NULL,deliver_at INTEGER NOT NULL,opened_at INTEGER,sender_day TEXT NOT NULL,nonce TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(sender,nonce));
    CREATE INDEX IF NOT EXISTS letters_inbox ON letters(recipient,deliver_at);
    CREATE INDEX IF NOT EXISTS letters_quota ON letters(sender,sender_day);
    CREATE TABLE IF NOT EXISTS blocks(owner TEXT NOT NULL REFERENCES users(id),blocked TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(owner,blocked));
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,resets_at INTEGER NOT NULL);
  `);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const dayFor = (user) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: user.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(clock()));
  const quota = (user) => ({
    limit: user.daily_limit,
    sent: one(
      "SELECT COUNT(*) AS count FROM letters WHERE sender=? AND sender_day=?",
      user.id,
      dayFor(user),
    ).count,
  });
  const publicUser = (user) => ({
    id: user.id,
    handle: user.handle,
    address: `${user.handle}@typer`,
    name: user.name,
    timezone: user.timezone,
    dailyLimit: user.daily_limit,
    minHours: user.min_hours,
    acceptMail: Boolean(user.accept_mail),
    quota: quota(user),
  });
  function session(request) {
    const token = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)typer_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    return token
      ? one(
          "SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
          digest(token),
          clock(),
        )
      : null;
  }
  function cookie(request, token, maxAge = SESSION_LIFE / 1000) {
    return `typer_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
  }
  function loginResponse(request, user) {
    const token = randomBytes(32).toString("hex");
    run("DELETE FROM sessions WHERE expires_at<=?", clock());
    run(
      "INSERT INTO sessions VALUES(?,?,?)",
      digest(token),
      user.id,
      clock() + SESSION_LIFE,
    );
    return json({ user: publicUser(user) }, 200, {
      "Set-Cookie": cookie(request, token),
    });
  }
  function throttle(key, limit = 20) {
    const now = clock(),
      entry = one("SELECT * FROM attempts WHERE key=?", key);
    if (entry && entry.resets_at > now && entry.count >= limit)
      throw fail("尝试过于频繁，请十五分钟后再试", 429);
    run(
      "INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END,resets_at=CASE WHEN resets_at<=? THEN ? ELSE resets_at END",
      key,
      now + 900000,
      now,
      now,
      now + 900000,
    );
  }
  function brief(row, user) {
    return {
      id: row.id,
      title: row.title,
      from: `${row.from_handle}@typer`,
      fromName: row.from_name,
      to: `${row.to_handle}@typer`,
      toName: row.to_name,
      createdAt: row.created_at,
      deliverAt: row.deliver_at,
      delivered: row.deliver_at <= clock(),
      opened: user.id === row.recipient ? Boolean(row.opened_at) : undefined,
      stampId: JSON.parse(row.snapshot).stampId,
    };
  }
  const joined =
    "SELECT l.*,s.handle AS from_handle,s.name AS from_name,r.handle AS to_handle,r.name AS to_name FROM letters l JOIN users s ON s.id=l.sender JOIN users r ON r.id=l.recipient";

  async function handle(request, { clientAddress = "local" } = {}) {
    try {
      const url = new URL(request.url),
        path = url.pathname.replace(/\/$/, ""),
        method = request.method;
      if (method === "GET" && path === "/api/health")
        return json({ ok: true, service: "Typer Post", storage: "sqlite" });
      let data = {};
      if (!["GET", "HEAD"].includes(method)) {
        if (request.headers.get("origin") !== url.origin)
          throw fail("请从 Typer 页面提交", 403);
        if (!request.headers.get("content-type")?.includes("application/json"))
          throw fail("请求格式无效", 415);
        const text = await request.text();
        if (Buffer.byteLength(text) > 250000) throw fail("信件过长", 413);
        try {
          data = text ? JSON.parse(text) : {};
          if (!data || typeof data !== "object" || Array.isArray(data))
            throw new Error("invalid body");
        } catch {
          throw fail("请求格式无效");
        }
      }
      if (method === "GET" && path === "/api/me") {
        const user = session(request);
        return json({ user: user ? publicUser(user) : null });
      }
      if (method === "POST" && ["/api/register", "/api/login"].includes(path)) {
        throttle(`auth-ip:${digest(clientAddress)}`, 40);
        const handle = handleOf(data.handle),
          password = data.password;
        if (
          !/^[a-z][a-z0-9_-]{2,23}$/.test(handle) ||
          typeof password !== "string" ||
          password.length < 10 ||
          password.length > 128
        )
          throw fail("邮址需为 3–24 位英文、数字或下划线；口令至少 10 位");
        throttle(`auth-handle:${handle}`);
        const found = one("SELECT * FROM users WHERE handle=?", handle);
        if (path === "/api/login") {
          const hash = await passwordHash(
            password,
            found?.salt || "typer-missing-account-dummy-salt",
          );
          if (
            !found ||
            !timingSafeEqual(hash, Buffer.from(found.password_hash, "hex"))
          )
            throw fail("邮址或口令不正确", 401);
          run("DELETE FROM attempts WHERE key=?", `auth-handle:${handle}`);
          return loginResponse(request, found);
        }
        if (found) throw fail("这个邮址已经有人使用", 409);
        const name = String(data.name || "").trim();
        if (!name || name.length > 40) throw fail("请填写不超过 40 字的署名");
        const timezone = String(data.timezone || "Asia/Shanghai");
        try {
          new Intl.DateTimeFormat("en", { timeZone: timezone });
        } catch {
          throw fail("时区无效");
        }
        const salt = randomBytes(24).toString("hex"),
          hash = await passwordHash(password, salt),
          id = randomUUID();
        try {
          run(
            "INSERT INTO users(id,handle,name,salt,password_hash,timezone,created_at) VALUES(?,?,?,?,?,?,?)",
            id,
            handle,
            name,
            salt,
            hash.toString("hex"),
            timezone,
            clock(),
          );
        } catch (error) {
          if (error.code?.includes("SQLITE"))
            throw fail("这个邮址已经有人使用", 409);
          throw error;
        }
        return loginResponse(
          request,
          one("SELECT * FROM users WHERE id=?", id),
        );
      }
      const user = session(request);
      if (!user) throw fail("请先领取或登录你的邮址", 401);
      if (path === "/api/logout" && method === "POST") {
        const token = request.headers
          .get("cookie")
          ?.match(/typer_session=([a-f0-9]{64})/)?.[1];
        if (token)
          run("DELETE FROM sessions WHERE token_hash=?", digest(token));
        return json({ ok: true }, 200, {
          "Set-Cookie": cookie(request, "", 0),
        });
      }
      if (path === "/api/settings" && method === "PATCH") {
        const limit = Number(data.dailyLimit),
          hours = Number(data.minHours);
        if (
          !Number.isInteger(limit) ||
          limit < 1 ||
          limit > 20 ||
          !Number.isInteger(hours) ||
          hours < 0 ||
          hours > 168 ||
          typeof data.acceptMail !== "boolean"
        )
          throw fail("寄信上限为 1–20 封，最短邮程为 0–168 小时");
        run(
          "UPDATE users SET daily_limit=?,min_hours=?,accept_mail=? WHERE id=?",
          limit,
          hours,
          Number(data.acceptMail),
          user.id,
        );
        return json({
          user: publicUser(one("SELECT * FROM users WHERE id=?", user.id)),
        });
      }
      if (path === "/api/recipient" && method === "GET") {
        throttle(`lookup:${user.id}`, 100);
        const other = one(
          "SELECT * FROM users WHERE handle=?",
          handleOf(url.searchParams.get("address")),
        );
        if (
          !other ||
          !other.accept_mail ||
          one(
            "SELECT 1 FROM blocks WHERE owner=? AND blocked=?",
            other.id,
            user.id,
          )
        )
          throw fail("这个邮址目前无法收信", 404);
        if (other.id === user.id) throw fail("请填写对方的邮址");
        return json({
          recipient: {
            id: other.id,
            address: `${other.handle}@typer`,
            name: other.name,
            minHours: other.min_hours,
          },
        });
      }
      if (path === "/api/blocks" && method === "GET")
        return json({
          blocks: all(
            "SELECT u.handle,u.name FROM blocks b JOIN users u ON u.id=b.blocked WHERE b.owner=?",
            user.id,
          ),
        });
      if (path === "/api/blocks" && ["POST", "DELETE"].includes(method)) {
        const other = one(
          "SELECT id FROM users WHERE handle=?",
          handleOf(data.address),
        );
        if (!other || other.id === user.id) throw fail("请输入有效的对方邮址");
        if (method === "POST")
          run("INSERT OR IGNORE INTO blocks VALUES(?,?)", user.id, other.id);
        else
          run(
            "DELETE FROM blocks WHERE owner=? AND blocked=?",
            user.id,
            other.id,
          );
        return json({ ok: true });
      }
      if (path === "/api/letters" && method === "POST") {
        const snapshot = letterSnapshot(data),
          address = handleOf(data.to),
          hours = Number(data.hours);
        if (
          !Number.isInteger(hours) ||
          hours < 0 ||
          hours > 168 ||
          typeof data.nonce !== "string" ||
          !/^[-\w]{16,80}$/.test(data.nonce)
        )
          throw fail("邮程或信件编号无效");
        const title =
          String(data.title || "一封来信")
            .trim()
            .slice(0, 80) || "一封来信";
        const fingerprint = digest(
          JSON.stringify({ snapshot, address, hours, title }),
        );
        db.exec("BEGIN IMMEDIATE");
        try {
          const existing = one(
            "SELECT * FROM letters WHERE sender=? AND nonce=?",
            user.id,
            data.nonce,
          );
          if (existing) {
            if (existing.fingerprint !== fingerprint)
              throw fail("这封信已经投邮，内容不能再更换", 409);
            db.exec("COMMIT");
            return json({
              letter: brief(one(`${joined} WHERE l.id=?`, existing.id), user),
              user: publicUser(user),
            });
          }
          const other = one("SELECT * FROM users WHERE handle=?", address);
          if (
            !other ||
            other.id === user.id ||
            !other.accept_mail ||
            one(
              "SELECT 1 FROM blocks WHERE owner=? AND blocked=?",
              other.id,
              user.id,
            )
          )
            throw fail("这个邮址目前无法收信", 404);
          const today = quota(user);
          if (today.sent >= today.limit)
            throw fail("今天的寄信名额已用完，草稿仍可继续写", 429);
          const id = randomUUID(),
            now = clock(),
            deliverAt = now + Math.max(hours, other.min_hours) * 3600000;
          run(
            "INSERT INTO letters(id,sender,recipient,title,snapshot,created_at,deliver_at,sender_day,nonce,fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?)",
            id,
            user.id,
            other.id,
            title,
            JSON.stringify(snapshot),
            now,
            deliverAt,
            dayFor(user),
            data.nonce,
            fingerprint,
          );
          db.exec("COMMIT");
          return json(
            {
              letter: brief(one(`${joined} WHERE l.id=?`, id), user),
              user: publicUser(user),
            },
            201,
          );
        } catch (error) {
          try {
            db.exec("ROLLBACK");
          } catch {}
          throw error;
        }
      }
      if (path === "/api/letters" && method === "GET") {
        const sent = url.searchParams.get("box") === "sent";
        const rows = sent
          ? all(
              `${joined} WHERE l.sender=? ORDER BY l.created_at DESC LIMIT 300`,
              user.id,
            )
          : all(
              `${joined} WHERE l.recipient=? AND l.deliver_at<=? ORDER BY l.deliver_at DESC LIMIT 300`,
              user.id,
              clock(),
            );
        return json({
          letters: rows.map((row) => brief(row, user)),
          user: publicUser(user),
          serverTime: clock(),
        });
      }
      const match = path.match(/^\/api\/letters\/([a-f0-9-]+)(\/open)?$/);
      if (match && (method === "GET" || (method === "POST" && match[2]))) {
        const row = one(`${joined} WHERE l.id=?`, match[1]);
        if (
          !row ||
          (row.sender !== user.id &&
            (row.recipient !== user.id || row.deliver_at > clock()))
        )
          throw fail("没有找到这封信", 404);
        if (match[2] && row.recipient === user.id) {
          run(
            "UPDATE letters SET opened_at=COALESCE(opened_at,?) WHERE id=?",
            clock(),
            row.id,
          );
          row.opened_at = clock();
        }
        return json({
          letter: { ...brief(row, user), ...JSON.parse(row.snapshot) },
        });
      }
      return json({ error: "没有这个邮局入口" }, 404);
    } catch (error) {
      if (!error.status) console.error("Typer Post:", error);
      return json(
        {
          error: error.status ? error.message : "邮局暂时无法处理，请稍后重试",
        },
        error.status || 500,
      );
    }
  }
  return { handle, close: () => db.close() };
}
