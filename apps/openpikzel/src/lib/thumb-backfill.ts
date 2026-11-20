import type { Creation } from './types';
import { thumbPath } from './workspaces';

export function selectThumbBackfill(creations: Pick<Creation, 'image_path' | 'settings'>[], owner: string, missing: Set<string>, already: Set<string>, remaining = 40) {
  const selected: Pick<Creation, 'image_path' | 'settings'>[] = [];
  const seen = new Set(already);
  for (const creation of creations) {
    const path = creation.image_path;
    if (!path || !path.startsWith(`${owner}/creations/`) || !path.endsWith('.png') || !missing.has(thumbPath(path)) || seen.has(path)) continue;
    if (selected.length >= remaining) break;
    seen.add(path); selected.push(creation);
  }
  return selected;
}

export async function makeThumb(url: string, portrait: boolean): Promise<Blob> {
  const response = await fetch(url, { priority: 'low' } as RequestInit);
  if (!response.ok) throw new Error('Image unavailable');
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = portrait ? 720 : 1280; canvas.height = portrait ? 1280 : 720;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Encoding failed')), 'image/jpeg', .82));
  } finally { bitmap.close(); }
}
