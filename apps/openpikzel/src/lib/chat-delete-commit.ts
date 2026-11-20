export type ChatDeleteStatus = "done" | "failed-nothing-changed" | "partial";

export async function commitChatDeletion(ids: string[], deleteCreation: (id: string) => Promise<void>, deleteChat: () => Promise<void>): Promise<ChatDeleteStatus> {
  let changed = false;
  try {
    for (const id of ids) { await deleteCreation(id); changed = true; }
    await deleteChat();
    return "done";
  } catch {
    return changed ? "partial" : "failed-nothing-changed";
  }
}
