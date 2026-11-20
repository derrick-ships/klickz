export async function optimisticUpdate<T>({ apply, persist, rollback }: { apply: () => void; persist: () => Promise<T>; rollback: () => void }): Promise<T> {
  apply();
  try { return await persist(); }
  catch (error) { rollback(); throw error; }
}
