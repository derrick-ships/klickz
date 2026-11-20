export function normalizeOtpCode(value: string): string {
  return value.replace(/[\s-]/g, "");
}
