import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPostOffice } from "../server/post-office.mjs";

const origin = "http://typer.test",
  password = "Test-only-letter-passphrase";
const payload = (nonce = "nonce-for-one-letter-0001") => ({
  nonce,
  to: "reader",
  title: "给远方的信",
  hours: 0,
  paperId: "republic-letter",
  stampId: "swallow",
  model: {
    kind: "letter",
    layoutId: "compact",
    lines: [
      {
        cursor: 2,
        glyphs: [{ id: "one", character: "你好", x: 0, units: 1, seed: 483 }],
      },
    ],
  },
});

test("real accounts: authenticated, delayed, private, idempotent delivery survives restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "typer-post-test-"));
  let now = Date.UTC(2026, 8, 22, 4),
    office = createPostOffice({
      filename: join(dir, "post.sqlite"),
      clock: () => now,
    });
  async function request(
    path,
    { method = "GET", body, cookie, requestOrigin = origin } = {},
  ) {
    const response = await office.handle(
      new Request(origin + "/api" + path, {
        method,
        headers: {
          ...(body
            ? { "Content-Type": "application/json", Origin: requestOrigin }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    return {
      status: response.status,
      body: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  try {
    const writer = await request("/register", {
      method: "POST",
      body: {
        handle: "writer",
        name: "写信人",
        password,
        timezone: "Asia/Taipei",
      },
    });
    const reader = await request("/register", {
      method: "POST",
      body: {
        handle: "reader",
        name: "收信人",
        password,
        timezone: "Asia/Taipei",
      },
    });
    const stranger = await request("/register", {
      method: "POST",
      body: {
        handle: "stranger",
        name: "其他人",
        password,
        timezone: "Asia/Taipei",
      },
    });
    assert.equal(writer.status, 200);
    assert.equal(reader.status, 200);
    assert.ok(writer.cookie);
    assert.equal(writer.body.user.quota.limit, 3);
    assert.equal(
      (
        await request("/login", {
          method: "POST",
          body: { handle: "writer", password: "wrong-long-password" },
        })
      ).status,
      401,
    );
    assert.equal((await request("/letters")).status, 401);
    assert.equal(
      (
        await request("/letters", {
          method: "POST",
          body: payload(),
          cookie: writer.cookie,
          requestOrigin: "https://evil.test",
        })
      ).status,
      403,
    );
    for (const model of [
      null,
      { kind: "letter", layoutId: "unknown", lines: [{ glyphs: [] }] },
      { kind: "letter", layoutId: "compact", lines: [null] },
    ]) {
      assert.equal(
        (
          await request("/letters", {
            method: "POST",
            body: { ...payload(), model },
            cookie: writer.cookie,
          })
        ).status,
        400,
      );
    }
    const sent = await request("/letters", {
      method: "POST",
      body: payload(),
      cookie: writer.cookie,
    });
    assert.equal(sent.status, 201);
    const id = sent.body.letter.id;
    assert.equal(
      sent.body.letter.deliverAt,
      now + 86400000,
      "recipient's minimum wait wins",
    );
    const retry = await request("/letters", {
      method: "POST",
      body: payload(),
      cookie: writer.cookie,
    });
    assert.equal(retry.body.letter.id, id);
    assert.equal(retry.body.user.quota.sent, 1);
    assert.equal(
      (
        await request("/letters", {
          method: "POST",
          body: { ...payload(), title: "changed" },
          cookie: writer.cookie,
        })
      ).status,
      409,
    );
    assert.deepEqual(
      (await request("/letters", { cookie: reader.cookie })).body.letters,
      [],
    );
    assert.equal(
      (await request(`/letters/${id}`, { cookie: reader.cookie })).status,
      404,
    );
    assert.equal(
      (
        await request(`/letters/${id}/open`, {
          method: "POST",
          body: {},
          cookie: reader.cookie,
        })
      ).status,
      404,
    );
    office.close();
    office = createPostOffice({
      filename: join(dir, "post.sqlite"),
      clock: () => now,
    });
    now += 86400000;
    assert.equal(
      (await request("/letters", { cookie: reader.cookie })).body.letters
        .length,
      1,
    );
    const opened = await request(`/letters/${id}/open`, {
      method: "POST",
      body: {},
      cookie: reader.cookie,
    });
    assert.equal(opened.body.letter.model.lines[0].glyphs[0].seed, 483);
    assert.equal(opened.body.letter.opened, true);
    assert.equal(
      (await request(`/letters/${id}`, { cookie: stranger.cookie })).status,
      404,
    );
    const senderView = (
      await request(`/letters/${id}`, { cookie: writer.cookie })
    ).body.letter;
    assert.equal(
      senderView.opened,
      undefined,
      "no read receipt leaks to the sender",
    );
    assert.equal(
      (
        await request("/settings", {
          method: "PATCH",
          cookie: reader.cookie,
          body: { dailyLimit: 3, minHours: 0, acceptMail: true },
        })
      ).status,
      200,
    );
    await request("/settings", {
      method: "PATCH",
      cookie: writer.cookie,
      body: { dailyLimit: 1, minHours: 24, acceptMail: true },
    });
    const instant = await request("/letters", {
      method: "POST",
      body: payload("next-day-another-letter-002"),
      cookie: writer.cookie,
    });
    assert.equal(instant.status, 201);
    assert.equal(instant.body.letter.deliverAt, now);
    assert.equal(
      (
        await request("/letters", {
          method: "POST",
          body: payload("quota-over-limit-letter-003"),
          cookie: writer.cookie,
        })
      ).status,
      429,
    );
    assert.equal(
      (await request("/letters", { cookie: reader.cookie })).body.letters
        .length,
      2,
    );
    await request("/blocks", {
      method: "POST",
      cookie: reader.cookie,
      body: { address: "writer@typer" },
    });
    now += 86400000;
    assert.equal(
      (
        await request("/letters", {
          method: "POST",
          body: payload("blocked-incoming-letter-004"),
          cookie: writer.cookie,
        })
      ).status,
      404,
    );
    await request("/blocks", {
      method: "DELETE",
      cookie: reader.cookie,
      body: { address: "writer" },
    });
    assert.equal(
      (
        await request("/letters", {
          method: "POST",
          body: payload("unblocked-new-letter-005"),
          cookie: writer.cookie,
        })
      ).status,
      201,
    );
    await request("/logout", {
      method: "POST",
      body: {},
      cookie: writer.cookie,
    });
    assert.equal(
      (await request("/me", { cookie: writer.cookie })).body.user,
      null,
    );
  } finally {
    office.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
