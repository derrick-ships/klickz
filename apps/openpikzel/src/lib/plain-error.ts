export type PlainError = { text: string; action: "Retry" | "Connect" | "Close" };

export function plainError(message: string): PlainError {
  if (/key|connect|unauthori[sz]ed|\b401\b|\b403\b/i.test(message)) {
    return { text: "Connect your AI key to continue.", action: "Connect" };
  }
  if (/too many|\b429\b|rate limit/i.test(message)) {
    return { text: "Please wait a moment and try again.", action: "Retry" };
  }
  return { text: "Something went wrong. Your work is saved.", action: "Retry" };
}
