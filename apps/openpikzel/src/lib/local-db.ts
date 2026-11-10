import { assertUniqueProfileName, dedupeProfileNames, type ProfileKind, type DatedProfile } from "./profile-name";
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

export async function localProfileTransaction<T extends DatedProfile>(kind: ProfileKind, operation: { create: T } | { id: string; name: string } | { repair: true }): Promise<T | T[]> {
  const db = await database();
  const store = kind === "persona" ? "personas" : "styles";
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const request = objectStore.getAll();
    let result: T | T[];
    let error: unknown;
    request.onsuccess = () => {
      try {
        const rows = request.result as T[];
        if ("repair" in operation) {
          result = dedupeProfileNames(rows);
          for (const row of result) if (rows.find(previous => previous.id === row.id)?.name !== row.name) objectStore.put(row);
        } else {
          const name = ("create" in operation ? operation.create.name : operation.name).trim();
          if (name.length < 3) throw new Error("Name must be at least 3 characters");
          if (name.length > 80) throw new Error("Use a name up to 80 characters.");
          const id = "create" in operation ? undefined : operation.id;
          const row = "create" in operation ? operation.create : rows.find(item => item.id === id);
          if (!row) throw new Error("This profile could not be found.");
          assertUniqueProfileName(rows, name, kind, id);
          result = { ...row, name };
          if ("create" in operation) objectStore.add(result); else objectStore.put(result);
        }
      } catch (cause) { error = cause; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(error || tx.error); };
    tx.onerror = () => { error ||= tx.error; };
  });
}
export async function localCreateProfile<T extends DatedProfile>(kind: ProfileKind, profile: T): Promise<T> {
  return localProfileTransaction(kind, { create: profile }) as Promise<T>;
}
export async function localRenameProfile<T extends DatedProfile>(kind: ProfileKind, id: string, name: string): Promise<T> {
  return localProfileTransaction(kind, { id, name }) as Promise<T>;
}
