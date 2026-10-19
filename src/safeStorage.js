// Browser storage may be full, disabled or private. Writing must never stop
// the machine from printing; callers decide how to tell the writer.
function storageOf(storage) {
  return storage === undefined ? globalThis.localStorage : storage;
}

export function readStored(key, legacyKey, storage) {
  try {
    const store = storageOf(storage);
    const current = store.getItem(key);
    if (current !== null || !legacyKey) return current;
    const legacy = store.getItem(legacyKey);
    if (legacy !== null) writeStored(key, legacy, store);
    return legacy;
  } catch {
    return null;
  }
}

export function writeStored(key, value, storage) {
  try {
    storageOf(storage).setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key, storage) {
  try {
    storageOf(storage).removeItem(key);
  } catch { /* Nothing stored is nothing to remove. */ }
}
