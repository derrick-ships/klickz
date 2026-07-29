/**
 * The people library — upload a person once, reuse them across thumbnails
 * with their framing intact. This is FR-3, and it is the thing the reference
 * tool cannot do: it forgets everything on reload.
 *
 * Storage is localStorage. Klickz is an internal tool (DEC: 2026-07-29), so
 * there are no accounts and nothing to sync.
 */

const STORAGE_KEY = "klickz.people.v1";

/** Tallest a stored person image is allowed to stay. */
const MAX_STORED_HEIGHT = 900;

export type Person = {
  id: string;
  name: string;
  /** PNG data URL. PNG, not JPEG — cutouts need their alpha channel. */
  src: string;
  scale: number;
  x: number;
  y: number;
};

export type SaveResult = { ok: true } | { ok: false; error: string };

export function loadPeople(): Person[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Tolerate partial records rather than throwing away the whole library
    // because one entry is malformed.
    return parsed.filter(
      (p): p is Person =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Person).id === "string" &&
        typeof (p as Person).src === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Persists the library. Returns a result rather than throwing, because the
 * realistic failure here is a quota overflow on a big photo — and silently
 * dropping someone's saved person is exactly the kind of data loss that
 * should never be swallowed.
 */
export function savePeople(people: Person[]): SaveResult {
  if (typeof window === "undefined") {
    return { ok: false, error: "No browser storage available." };
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
    return { ok: true };
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return {
      ok: false,
      error: isQuota
        ? "Storage is full. Delete a saved person and try again."
        : "Could not save to browser storage.",
    };
  }
}

/**
 * Reads an image file and returns a downscaled PNG data URL.
 *
 * ponytail: downscaling to 900px is what keeps localStorage viable — a raw
 * phone photo is several MB and two of them would blow the ~5MB budget. The
 * canvas never draws a person taller than 720px, so nothing visible is lost.
 * Ceiling is roughly 5-10 saved people; IndexedDB is the upgrade path if that
 * ever bites.
 */
export async function fileToImageDataUrl(
  file: File,
  maxHeight = MAX_STORED_HEIGHT,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxHeight / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D context to resize the image.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

export function newPersonId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}
