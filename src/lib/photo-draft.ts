// The photos a signed-out visitor picked on a landing page, kept in the
// browser's IndexedDB while sign-in leaves the page (Google redirects; a
// magic link opens a new tab), so the page can send them on return. Files
// never reach the server before sign-in.

const DB = "vibemovo";
const STORE = "photo-drafts";
// A draft older than this is a visit the visitor gave up on.
const MAX_AGE_MS = 60 * 60 * 1000;

type Draft = { photos: File[]; savedAt: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// Each fails quietly: without IndexedDB (private windows in some browsers)
// the visitor picks the photos again after sign-in.

export async function savePhotoDraft(key: string, photos: File[]): Promise<void> {
  await run("readwrite", (store) => store.put({ photos, savedAt: Date.now() } satisfies Draft, key)).catch(() => {});
}

export async function loadPhotoDraft(key: string): Promise<File[] | null> {
  const draft = await run<Draft | undefined>("readonly", (store) => store.get(key)).catch(() => undefined);
  return draft && Date.now() - draft.savedAt < MAX_AGE_MS ? draft.photos : null;
}

export async function clearPhotoDraft(key: string): Promise<void> {
  await run("readwrite", (store) => store.delete(key)).catch(() => {});
}
