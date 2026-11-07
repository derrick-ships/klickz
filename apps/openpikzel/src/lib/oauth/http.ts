import { AppError } from "../validation";
export const oauthHeaders = {
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};
export function oauthFailure(e: unknown, error = "invalid_grant") {
  return Response.json(
    {
      error,
      error_description:
        e instanceof AppError
          ? e.message
          : "The authorization request could not complete.",
    },
    { status: e instanceof AppError ? e.status : 400, headers: oauthHeaders },
  );
}
export async function limitedText(request: Request, max = 32000) {
  if (Number(request.headers.get("content-length")) > max)
    throw new AppError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString();
}
export async function limitedJson(request: Request, max = 16000) {
  return JSON.parse(await limitedText(request, max));
}
