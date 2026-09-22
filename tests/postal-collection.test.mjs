import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { STAMPS } from "../src/stamps.js";
import { PAPER_TEMPLATES } from "../src/paperTemplates.js";
import { PAPER, STRIKE, GUIDE_TOP, getPaperLayout, inkEnvelope, REFERENCE_KEYS } from "../src/referenceGeometry.js";
import { MACHINE_MODELS, getModelKeys } from "../src/machineModels.js";
import { exportSlices } from "../src/writingModel.js";
import { pointerKeyAction } from "../src/pointerKeyboard.js";
import { createPostOffice } from "../server/post-office.mjs";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("the four selected stationery designs keep a full page of ink clear of their art", () => {
  const papers = PAPER_TEMPLATES.filter(paper => paper.collection === "selected-2026-09");
  assert.deepEqual(papers.map(paper => paper.id), ["florentine", "bauhaus", "terracotta", "iris"]);
  for (const paper of papers) for (const layoutId of ["compact", "reference"]) {
    assert.ok(existsSync(new URL(`../public/${paper.asset.replace(/^\//, "")}`, import.meta.url)));
    const model = {kind:"letter", paperId:paper.id, layoutId};
    const layout = getPaperLayout(model), original = getPaperLayout({layoutId});
    close(layout.glyphHeight, original.glyphHeight);
    close(layout.linePitch, original.linePitch);
    close(layout.glyphRange/layout.maxUnits, original.glyphRange/original.maxUnits);
    const left = layout.trackLeft + layout.trackWidth * layout.glyphStart / 100;
    const right = left + layout.trackWidth * (layout.glyphRange + layout.glyphWidth + .2) / 100;
    assert.ok(left >= paper.printArea.left - 1e-8);
    assert.ok(right < paper.printArea.right);
    const glyphHeight = PAPER.width * layout.trackWidth * layout.glyphHeight / 10000;
    for (let i=0; i<layout.maxLines; i++) {
      const top = layout.start + i * layout.feed;
      assert.ok(top + glyphHeight / layout.paperHeight * 100 + .2 < paper.printArea.bottom);
      close(PAPER.top + (top-i*layout.feed)*layout.paperHeight/100 + glyphHeight/2, STRIKE.y);
    }
    assert.ok(layout.maxLines >= (layoutId === "compact" ? 23 : 7));
    const slice = exportSlices({...model,lines:Array.from({length:layout.maxLines},()=>({glyphs:[]}))})[0];
    assert.equal(slice.last, layout.maxLines);
    close(slice.top / 2480, layout.paperHeight * layout.start / 100 / PAPER.width);
  }
});
test("every collectible and postcard has a distinct, shipped illustration", () => {
  assert.equal(STAMPS.length, 12);
  assert.equal(new Set(STAMPS.map(stamp => stamp.id)).size, 12);
  assert.equal(new Set(STAMPS.map(stamp => stamp.asset)).size, 12);
  const cards = PAPER_TEMPLATES.filter(paper => paper.format === "postcard");
  assert.equal(cards.length, 6);
  assert.equal(new Set(cards.map(paper => paper.frontAsset)).size, 6);
  for (const asset of [...STAMPS.map(stamp => stamp.asset), ...cards.flatMap(paper => [paper.asset, paper.frontAsset])]) {
    assert.ok(existsSync(new URL(`../public/${asset.replace(/^\//, "")}`, import.meta.url)), asset);
  }
});

for (const layoutId of ["reference", "compact"]) test(`${layoutId}: postcard rows feed at the fixed strike and stay inside the border`, () => {
  const model = { kind: "sheet", paperFormat: "postcard", layoutId, lines: [] };
  const layout = getPaperLayout(model);
  close(PAPER.width / layout.paperHeight, 148 / 105);
  const glyph = PAPER.width * layout.trackWidth * layout.glyphHeight / 10000;
  const pitch = PAPER.width * layout.trackWidth * layout.linePitch / 10000;
  const envelope = inkEnvelope(layout);
  assert.ok(layout.bailY + layout.bailHeight / 2 < envelope.top);
  assert.ok(GUIDE_TOP > envelope.bottom);
  for (let row = 0; row < layout.maxLines; row++) {
    const top = layout.paperHeight * layout.start / 100 + row * pitch;
    const feed = row * layout.paperHeight * layout.feed / 100;
    close(PAPER.top + top - feed + glyph / 2, STRIKE.y);
    assert.ok(top + glyph < layout.paperHeight * .95, `last ink clears the postcard border, row ${row}`);
  }
  model.lines = Array.from({length: layout.maxLines}, () => ({glyphs:[]}));
  const [slice] = exportSlices(model);
  assert.equal(slice.height, 1759);
  close(slice.top / 2480, layout.paperHeight * layout.start / 100 / PAPER.width);
  assert.equal(slice.last, layout.maxLines);
  assert.equal(getPaperLayout({...model, kind:"scroll"}).postcard, false);
});

test("mouse keys retain physical key identity and route shifted characters through normal typing", () => {
  for (const machine of MACHINE_MODELS) {
    for (const key of getModelKeys(machine)) {
      const action = pointerKeyAction(key);
      if (key.code.startsWith("Shift")) assert.equal(action.type, "shift");
      else {
        assert.equal(action.type, "character");
        assert.equal(action.code, key.code);
        assert.equal([...action.character].length, 1);
      }
    }
  }
  const action = (code, shift) => pointerKeyAction(REFERENCE_KEYS.find(key => key.code === code), shift);
  assert.equal(action("KeyA").character, "a");
  assert.equal(action("KeyA", true).character, "A");
  assert.equal(action("Digit1", true).character, "!");
  assert.equal(action("Quote", true).character, '"');
  assert.equal(action("Space").character, " ");
});

test("mailed postcards preserve their art, format, stamp and ink; forged capacity is rejected", async () => {
  const dir = mkdtempSync(join(tmpdir(), "typer-card-test-"));
  const office = createPostOffice({filename: join(dir, "post.sqlite")});
  const origin = "http://typer.test";
  const send = async (path, body, cookie, method="POST") => {
    const response = await office.handle(new Request(`${origin}/api${path}`, {
      method, headers: {Origin:origin, "Content-Type":"application/json", ...(cookie?{Cookie:cookie}:{})},
      ...(method==="GET"?{}:{body:JSON.stringify(body)}),
    }));
    return {status:response.status, data:await response.json(), cookie:response.headers.get("set-cookie")?.split(";")[0]};
  };
  try {
    const a = await send("/register", {handle:"postcard_writer", name:"写信人", password:"collection-test-password", timezone:"Asia/Taipei"});
    const b = await send("/register", {handle:"postcard_reader", name:"收信人", password:"collection-test-password", timezone:"Asia/Taipei"});
    await send("/settings", {dailyLimit:3,minHours:0,acceptMail:true}, b.cookie, "PATCH");
    const row = {cursor:1,glyphs:[{id:"one",character:"春",x:0,units:1,seed:517}]};
    const payload = {nonce:"postcard-delivery-nonce-0001", to:"postcard_reader", hours:0, paperId:"postcard-kyoto", stampId:"dunhuang", model:{kind:"letter",layoutId:"compact",lines:[row]}};
    const sent = await send("/letters", payload, a.cookie);
    assert.equal(sent.status, 201);
    const opened = await send(`/letters/${sent.data.letter.id}/open`, {}, b.cookie);
    assert.equal(opened.data.letter.paperId, "postcard-kyoto");
    assert.equal(opened.data.letter.stampId, "dunhuang");
    assert.equal(opened.data.letter.model.paperFormat, "postcard");
    assert.equal(opened.data.letter.model.lines[0].glyphs[0].seed, 517);
    const limit = getPaperLayout({paperFormat:"postcard", layoutId:"compact"}).maxLines;
    const forged = {...payload, nonce:"postcard-capacity-nonce-0002", model:{...payload.model, paperFormat:"sheet", lines:Array.from({length:limit+1},()=>row)}};
    assert.equal((await send("/letters", forged, a.cookie)).status, 400);
    assert.equal((await send("/letters", {...payload, stampId:"invented"}, a.cookie)).status, 400);
    const illustrated = {...payload, nonce:"stationery-iris-nonce-0003", paperId:"iris", model:{...payload.model, paperId:"reference-ivory"}};
    const posted = await send("/letters", illustrated, a.cookie);
    assert.equal(posted.status, 201);
    const received = await send(`/letters/${posted.data.letter.id}/open`, {}, b.cookie);
    assert.equal(received.data.letter.paperId, "iris");
    assert.equal(received.data.letter.model.paperId, "iris", "trusted selected stock overrides forged model paper");
    assert.equal(received.data.letter.model.lines[0].glyphs[0].seed, 517);
    const irisLayout = getPaperLayout(received.data.letter.model);
    const tooLong = {...illustrated, nonce:"stationery-iris-overflow-0004", model:{...illustrated.model,lines:Array.from({length:irisLayout.maxLines+1},()=>row)}};
    assert.equal((await send("/letters", tooLong, a.cookie)).status, 400);
    const tooWide = {...illustrated, nonce:"stationery-iris-overflow-0005", model:{...illustrated.model,lines:[{cursor:26,glyphs:[{...row.glyphs[0],x:26}]}]}};
    assert.equal((await send("/letters", tooWide, a.cookie)).status, 400);
  } finally { office.close(); rmSync(dir, {recursive:true, force:true}); }
});
