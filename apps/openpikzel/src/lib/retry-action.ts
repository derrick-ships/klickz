// Actions that may spend provider credits. They are never replayed from the error banner:
// a failed paid request can still have been charged, so the user checks My creations instead.
const paid = /generat|analyz|scor|fix|rearrang|improv|preparing|finding title|import/i;
export const isPaidAction = (label: string) => paid.test(label);
/** Only free actions get a replay; paid ones return null so the banner never offers Retry for them. */
export function retryableAction(label: string, replay: () => void, uncertain: boolean): (() => void) | null {
  return uncertain || isPaidAction(label) ? null : replay;
}
export function retryAction(action: (() => void) | null): void {
  action?.();
}
