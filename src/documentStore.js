let ready;
function database() {
  if (!ready)
    ready = new Promise((resolve, reject) => {
      const request = indexedDB.open("typer-documents-v1", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("documents", { keyPath: "id" });
        const lines = db.createObjectStore("lines", {
          keyPath: ["documentId", "index"],
        });
        lines.createIndex("documentId", "documentId");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        ready = null;
        reject(request.error);
      };
    });
  return ready;
}
function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("稿件保存被中止"));
  });
}
function value(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocument(
  model,
  { paperId, archived = false, all = false, ...extra } = {},
) {
  const db = await database(),
    tx = db.transaction(["documents", "lines"], "readwrite");
  const { lines, ...rest } = model;
  tx.objectStore("documents").put({
    ...rest,
    ...extra,
    paperId,
    archived,
    lineCount: lines.length,
    updatedAt: new Date().toISOString(),
    excerpt: lines
      .slice(0, 6)
      .flatMap((row) => row.glyphs.map((g) => g.character))
      .join("")
      .slice(0, 100),
  });
  const indices = all ? lines.map((_, i) => i) : [model.activeLine];
  for (const index of indices)
    tx.objectStore("lines").put({
      documentId: model.id,
      index,
      ...lines[index],
    });
  await done(tx);
}
export async function readDocument(id) {
  if (!id) return null;
  const db = await database(),
    tx = db.transaction(["documents", "lines"], "readonly");
  const [meta, rows] = await Promise.all([
    value(tx.objectStore("documents").get(id)),
    value(tx.objectStore("lines").index("documentId").getAll(id)),
  ]);
  if (!meta) return null;
  const lines = Array.from({ length: meta.lineCount }, () => ({
    glyphs: [],
    cursor: 0,
  }));
  for (const { index, glyphs, cursor } of rows)
    lines[index] = { glyphs, cursor };
  return { ...meta, lines };
}
export async function listDocuments() {
  const db = await database();
  return value(
    db.transaction("documents", "readonly").objectStore("documents").getAll(),
  );
}
