export function retryAction(action: (() => void) | null): void {
  action?.();
}
