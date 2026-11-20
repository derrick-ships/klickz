export type PlainError = { text: string; action: "Retry" | "Connect" | "Close" | "My creations" };

export function plainError(message: string): PlainError {
  if (/reconcil|check (?:your )?(?:history|my creations)|may have used|outcome uncertain/i.test(message)) {
    return { text: "We're not sure it finished. Check My creations before trying again.", action: "My creations" };
  }
  if (/\b(?:api |ai )?key\b|connect your key|\b401\b|\b403\b/i.test(message)) {
    return { text: "Connect your AI key to continue.", action: "Connect" };
  }
  if (/too many|\b429\b|rate limit/i.test(message)) {
    return { text: "Please wait a moment and try again.", action: "Retry" };
  }
  return { text: "Something went wrong. Please try again.", action: "Retry" };
}
