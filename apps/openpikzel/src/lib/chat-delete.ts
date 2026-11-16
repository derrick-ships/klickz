import type { Creation } from "./types";

/**
 * What deleting a chat removes: every creation in it and its stored files.
 * - Each creation's image, plus the YouTube-ready .jpg copy saved next to a generated .png.
 * - Reference uploads attached in this chat, unless something outside the chat still uses them
 *   (another chat's creation, a persona or a style). Those stay.
 * Pure, so the selection is tested without storage.
 */
export function chatDeletionPlan(
  chatId: string,
  creations: Pick<Creation, "id" | "conversation_id" | "image_path" | "reference_path" | "reference_paths">[],
  keepElsewhere: string[] = [],
) {
  const inChat = creations.filter((c) => c.conversation_id === chatId);
  const others = creations.filter((c) => c.conversation_id !== chatId);
  const used = new Set<string>(keepElsewhere);
  for (const c of others) for (const p of [c.image_path, c.reference_path, ...(c.reference_paths || [])]) if (p) used.add(p);
  const paths = new Set<string>();
  for (const c of inChat) {
    if (c.image_path && !used.has(c.image_path)) {
      paths.add(c.image_path);
      if (/\/creations\/[^/]+\.png$/.test(c.image_path)) paths.add(c.image_path.replace(/\.png$/, ".jpg"));
    }
    for (const p of [c.reference_path, ...(c.reference_paths || [])]) if (p && !used.has(p)) paths.add(p);
  }
  return { creationIds: inChat.map((c) => c.id), paths: [...paths] };
}
