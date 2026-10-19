import { saveDocument, readDocument, listDocuments, deleteDocument, documentExcerpt } from "./documentStore.js";
import { readStored, removeStored } from "./safeStorage.js";

// Sheets used to live in localStorage, whose small quota could stop the
// machine from saving. Every manuscript now shares the roll's IndexedDB store.
export const LEGACY_MANUSCRIPT_KEY = "typer-manuscripts-v1";
const OLDER_MANUSCRIPT_KEY = "lead-typewriter-manuscripts-v1";

// Recognises a sheet that was already stored without keeping its ink in memory.
export function manuscriptHash(model, paperId) {
  const text = `${paperId}\n${JSON.stringify(model)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return `${text.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

function entryOf(doc) {
  return {
    id: doc.id,
    documentId: doc.id,
    kind: doc.kind || "sheet",
    paperId: doc.paperId,
    paperFormat: doc.paperFormat,
    savedAt: doc.updatedAt,
    lineCount: doc.lineCount,
    excerpt: doc.excerpt,
    contentHash: doc.contentHash,
  };
}

export async function listManuscripts() {
  return (await listDocuments())
    .filter((doc) => doc.archived && doc.kind !== "letter")
    .map(entryOf)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function archiveManuscript(
  model,
  { paperId, id = globalThis.crypto.randomUUID(), savedAt = new Date().toISOString() },
) {
  const contentHash = manuscriptHash(model, paperId);
  await saveDocument({ ...model, id }, {
    paperId, archived: true, all: true, updatedAt: savedAt, contentHash,
  });
  return entryOf({
    ...model, id, paperId, updatedAt: savedAt, contentHash,
    lineCount: model.lines.length, excerpt: documentExcerpt(model.lines),
  });
}

export const deleteManuscript = deleteDocument;

// The newest unarchived roll: the working copy the active pointer names.
export async function latestWorkingScroll() {
  const [latest] = (await listDocuments())
    .filter((doc) => doc.kind === "scroll" && !doc.archived)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return latest ? readDocument(latest.id) : null;
}

export async function migrateLegacyManuscripts(storage) {
  let entries;
  try {
    entries = JSON.parse(readStored(LEGACY_MANUSCRIPT_KEY, OLDER_MANUSCRIPT_KEY, storage));
  } catch {
    return 0;
  }
  if (!Array.isArray(entries)) return 0;
  const valid = entries.filter(
    (entry) => entry?.id && entry.savedAt && Array.isArray(entry.model?.lines) && entry.model.lines.length,
  );
  // Puts are idempotent, so an interrupted migration simply runs again.
  for (const entry of valid)
    await archiveManuscript(entry.model, {
      id: entry.id, paperId: entry.paperId, savedAt: entry.savedAt,
    });
  removeStored(LEGACY_MANUSCRIPT_KEY, storage);
  removeStored(OLDER_MANUSCRIPT_KEY, storage);
  return valid.length;
}
