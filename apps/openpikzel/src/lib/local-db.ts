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
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
export async function localPut(store: Store, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
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
