import { POST_API_ORIGIN } from "./runtimeConfig.js";

// The Pages frontend and mail API use different sites. A tab-scoped session
// avoids third-party cookies (blocked by Safari), while surviving reloads.
const key = `typer-post-session-v1:${POST_API_ORIGIN}`;
let memorySession = null;
function session() {
  try {
    memorySession = JSON.parse(sessionStorage.getItem(key)) || memorySession;
  } catch { /* Private browsing may disallow storage; this tab still works. */ }
  return memorySession?.expiresAt > Date.now() ? memorySession : null;
}
function remember(value) {
  memorySession = value;
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* Keep the in-memory session when storage is unavailable. */ }
}

export async function postApi(path, method = "GET", body) {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const token = POST_API_ORIGIN ? session()?.token : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${POST_API_ORIGIN}/api${path}`, {
    method,
    credentials: POST_API_ORIGIN ? "omit" : "same-origin",
    cache: "no-store",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("邮局连接暂时中断，请稍后重试");
  const data = await response.json();
  if (response.status === 401 && token) remember(null);
  if (!response.ok) throw new Error(data.error || "邮局暂时无法处理");
  if (data.session) remember(data.session);
  if (path === "/logout" || (path === "/me" && !data.user)) remember(null);
  return data;
}
