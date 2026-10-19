import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { readStored, writeStored, removeStored } from "../src/safeStorage.js";
import { MAX_PASTE_GRAPHEMES, acceptsKeyRepeat, limitPaste } from "../src/typingInput.js";
import { saveDocument, readDocument, deleteDocument, listDocuments, documentExcerpt } from "../src/documentStore.js";
import { archiveManuscript, listManuscripts, manuscriptHash, migrateLegacyManuscripts, LEGACY_MANUSCRIPT_KEY } from "../src/manuscriptStore.js";
import { blankDocument } from "../src/writingModel.js";

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}
const fullStorage = {
  getItem: () => null,
  setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
  removeItem: () => {},
};
const blockedStorage = {
  getItem: () => { throw new DOMException("denied", "SecurityError"); },
  setItem: () => { throw new DOMException("denied", "SecurityError"); },
  removeItem: () => { throw new DOMException("denied", "SecurityError"); },
};
const page = (text, extra = {}) => blankDocument("sheet", {
  layoutId: "compact",
  lines: [{ cursor: text.length, glyphs: [...text].map((character, x) => ({ id: `${x}`, character, x, units: 1, seed: x })) }],
  ...extra,
});

test("full or blocked browser storage never throws into the strike cycle", () => {
  assert.equal(writeStored("typer-draft-v1", "{}", fullStorage), false);
  assert.equal(writeStored("typer-draft-v1", "{}", blockedStorage), false);
  assert.equal(readStored("typer-draft-v1", "lead-typewriter-draft-v1", blockedStorage), null);
  assert.doesNotThrow(() => removeStored("typer-draft-v1", blockedStorage));
  const storage = memoryStorage({ "lead-typewriter-draft-v1": "old" });
  assert.equal(readStored("typer-draft-v1", "lead-typewriter-draft-v1", storage), "old");
  assert.equal(storage.data.get("typer-draft-v1"), "old", "legacy value is migrated");
  assert.equal(writeStored("typer-draft-v1", "new", storage), true);
});

test("pasted text is capped at whole graphemes and held keys follow the machine", () => {
  const long = "字".repeat(MAX_PASTE_GRAPHEMES) + "👩‍👩‍👧尾";
  const { text, dropped } = limitPaste(long);
  assert.equal([...text].length, MAX_PASTE_GRAPHEMES);
  assert.equal(dropped, 2, "a joined emoji counts as one dropped grapheme");
  assert.deepEqual(limitPaste("一\r\n二", 5), { text: "一\n二", dropped: 0 });
  assert.equal(limitPaste("👩‍👩‍👧x", 1).text, "👩‍👩‍👧", "never splits a grapheme");
  assert.equal(acceptsKeyRepeat("Backspace", 0), true);
  assert.equal(acceptsKeyRepeat(" ", 0), true);
  assert.equal(acceptsKeyRepeat("Backspace", 1), false, "no backlog after release");
  assert.equal(acceptsKeyRepeat("a", 0), false, "printing keys do not auto-repeat");
  assert.equal(acceptsKeyRepeat("Enter", 0), false);
});

test("excerpts stay bounded and readable for long rolls", () => {
  const roll = { lines: Array.from({ length: 5000 }, () => ({ glyphs: [{ character: "路" }, { character: " " }] })) };
  const excerpt = documentExcerpt(roll.lines);
  assert.equal(excerpt.length, 100);
  assert.ok(!/\s\s/.test(excerpt));
  assert.equal(documentExcerpt([{ glyphs: [] }, { glyphs: [{ character: "后" }] }]), "后");
});

test("rewriting a document drops stale rows and deleting removes every row", async () => {
  const model = blankDocument("scroll", {
    lines: Array.from({ length: 4 }, (_, i) => ({ cursor: 1, glyphs: [{ id: `${i}`, character: "长", x: 0, units: 1, seed: i }] })),
    activeLine: 3,
  });
  await saveDocument(model, { paperId: "reference-ivory", all: true });
  await saveDocument({ ...model, lines: model.lines.slice(0, 2), activeLine: 1 }, { paperId: "reference-ivory", all: true });
  assert.equal((await readDocument(model.id)).lines.length, 2);
  await deleteDocument(model.id);
  assert.equal(await readDocument(model.id), null);
  const db = await new Promise((resolve) => { const r = indexedDB.open("typer-documents-v1"); r.onsuccess = () => resolve(r.result); });
  const rows = await new Promise((resolve) => {
    const r = db.transaction("lines").objectStore("lines").index("documentId").getAll(model.id);
    r.onsuccess = () => resolve(r.result);
  });
  db.close();
  assert.deepEqual(rows, []);
});

test("localStorage manuscripts migrate once into IndexedDB with their date and ink", async () => {
  const sheet = page("旧稿", { paperId: "reference-ivory" });
  const legacy = [{ id: "legacy-1", savedAt: "2026-09-01T08:00:00.000Z", paperId: "reference-ivory", model: sheet, excerpt: "旧稿" }];
  const storage = memoryStorage({ [LEGACY_MANUSCRIPT_KEY]: JSON.stringify(legacy) });
  assert.equal(await migrateLegacyManuscripts(storage), 1);
  assert.equal(storage.getItem(LEGACY_MANUSCRIPT_KEY), null, "quota is released");
  assert.equal(await migrateLegacyManuscripts(storage), 0);
  const entry = (await listManuscripts()).find((item) => item.id === "legacy-1");
  assert.equal(entry.savedAt, "2026-09-01T08:00:00.000Z");
  assert.equal(entry.excerpt, "旧稿");
  assert.equal(entry.contentHash, manuscriptHash(sheet, "reference-ivory"), "duplicates stay recognisable");
  const restored = await readDocument("legacy-1");
  assert.deepEqual(restored.lines, sheet.lines);
  assert.equal(restored.kind, "sheet");
});

test("the manuscript box lists archives only, and one roll keeps one entry", async () => {
  const letter = { ...page("私信"), kind: "letter", ownerId: "someone" };
  await saveDocument(letter, { paperId: "lunar-observatory", all: true });
  const active = blankDocument("scroll", { lines: page("长卷").lines });
  await saveDocument(active, { paperId: "reference-ivory", all: true });
  const first = await archiveManuscript(active, { paperId: "reference-ivory" });
  const longer = { ...active, lines: [...active.lines, ...page("续写").lines], activeLine: 1 };
  const second = await archiveManuscript(longer, { paperId: "reference-ivory", id: first.id });
  assert.equal(second.id, first.id);
  const entries = await listManuscripts();
  assert.equal(entries.filter((item) => item.id === first.id).length, 1);
  assert.equal(entries.find((item) => item.id === first.id).lineCount, 2);
  assert.ok(!entries.some((item) => item.id === letter.id), "letters stay in private drafts");
  assert.ok(!entries.some((item) => item.id === active.id), "working copies are not archives");
  assert.ok((await listDocuments()).some((doc) => doc.id === letter.id));
});
