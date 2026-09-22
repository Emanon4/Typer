import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createPostService } from "./post-service.mjs";

export function createPostOffice({ filename = ".typer-data/post.sqlite", ...options } = {}) {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  if (filename !== ":memory:") chmodSync(filename, 0o600);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(readFileSync(new URL("../post-worker/migrations/0001_post.sql", import.meta.url), "utf8"));
  const store = {
    one: (sql, ...args) => db.prepare(sql).get(...args),
    all: (sql, ...args) => db.prepare(sql).all(...args),
    run: (sql, ...args) => db.prepare(sql).run(...args),
  };
  return { ...createPostService({ ...options, store }), close: () => db.close() };
}
