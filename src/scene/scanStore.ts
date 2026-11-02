// Eigener Scan bleibt auf dem Gerät: IndexedDB im Browser, nie im Repo, nie im Netz.

const DB = "e46-fahrwerk";
const STORE = "scan";
const KEY = "glb";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export interface StoredScan {
  name: string;
  data: ArrayBuffer;
}

export async function saveScan(s: StoredScan): Promise<void> {
  try {
    await tx("readwrite", (st) => st.put(s, KEY));
  } catch {
    /* Speicher nicht verfügbar – Scan bleibt nur bis zum Neuladen */
  }
}

export async function loadScan(): Promise<StoredScan | null> {
  try {
    return ((await tx("readonly", (st) => st.get(KEY))) as StoredScan | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearScan(): Promise<void> {
  try {
    await tx("readwrite", (st) => st.delete(KEY));
  } catch {
    /* nichts zu tun */
  }
}
