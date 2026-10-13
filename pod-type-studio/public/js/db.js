// Designs are saved on the phone in IndexedDB, so closing the tab never loses work.
const DB_NAME = 'pod-type-studio';
const STORE = 'designs';
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Ask the browser not to evict saved designs when space runs low.
    navigator.storage?.persist?.().catch(() => {});
  }
  return dbp;
}

function tx(mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const result = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('Saving was interrupted — the phone may be out of storage.'));
      }),
  );
}

// Records: { id, design, thumb, updatedAt }
export const db = {
  async list() {
    const all = await tx('readonly', (s) => s.getAll());
    return all.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },
  get: (id) => tx('readonly', (s) => s.get(id)),
  put: (record) => tx('readwrite', (s) => s.put(record)),
  remove: (id) => tx('readwrite', (s) => s.delete(id)),
};
