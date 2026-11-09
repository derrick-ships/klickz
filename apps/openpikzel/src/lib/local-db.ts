import type { Creation, Persona, Style } from "./types";
export type LocalRecord = Creation | Persona | Style;
export type Store = "creations" | "personas" | "styles" | "assets" | "conversations" | "preferences" | "feedback";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("derrick-thumbnail-studio", 2);
    req.onupgradeneeded = () => {
      for (const name of ["creations", "personas", "styles", "assets", "conversations", "preferences", "feedback"])
        if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function localAll<T>(store: Store): Promise<T[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => {
      try {
        const rows = store === "assets" ? req.result.map((asset) =>
          asset.blob instanceof Blob ? asset :
          asset.bytes instanceof ArrayBuffer ? {...asset, blob: new Blob([asset.bytes], {type: asset.mime || "application/octet-stream"})} : asset
        ) : req.result;
        resolve(rows as T[]);
      } catch (error) { reject(error); }
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
export async function localPut(store: Store, value: unknown) {
  // Persist bytes instead of Blob handles: some WebKit stores cannot prepare Blob data.
  // Legacy Blob records remain readable, so existing local libraries need no migration.
  let stored = value;
  if (store === "assets" && value && typeof value === "object" && "blob" in value && value.blob instanceof Blob) {
    const {blob, ...rest} = value;
    stored = {...rest, bytes: await blob.arrayBuffer(), mime: blob.type};
  }
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(stored);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function localDelete(store: Store, id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
