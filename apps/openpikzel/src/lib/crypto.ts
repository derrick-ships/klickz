import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { AppError } from "./validation";
function key() {
  const raw = process.env.STUDIO_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(raw))
    throw new AppError(
      503,
      "Secure account connections are awaiting server setup.",
    );
  return Buffer.from(raw, "hex");
}
export function seal(value: unknown, purpose: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return [
    "opz1",
    iv.toString("base64url"),
    data.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
export function unseal<T>(token: string, purpose: string): T {
  if (token.length > 32000)
    throw new AppError(401, "Invalid connection token.");
  try {
    const [version, iv, data, tag, extra] = token.split(".");
    if (version !== "opz1" || extra) throw new Error();
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "base64url"),
    );
    cipher.setAAD(Buffer.from(purpose));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(
      Buffer.concat([
        cipher.update(Buffer.from(data, "base64url")),
        cipher.final(),
      ]).toString(),
    ) as T;
  } catch (e) {
    if (e instanceof AppError && e.status === 503) throw e;
    throw new AppError(401, "Invalid or expired connection token.");
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const now = () => Math.floor(Date.now() / 1000);
export function appOrigin() {
  const origin = process.env.APP_ORIGIN || "http://localhost:3000";
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    (url.protocol !== "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  )
    throw new AppError(503, "Set the canonical HTTPS app origin.");
  return origin;
}
export const mcpResource = () => `${appOrigin()}/mcp`;
export function sameOrigin(request: Request) {
  const allowed = [appOrigin()];
  if (process.env.OWNER_GATE !== "false" && process.env.VERCEL_URL)
    allowed.push("https://" + process.env.VERCEL_URL);
  if (!allowed.includes(request.headers.get("origin") || ""))
    throw new AppError(403, "This action must be confirmed in OpenPikzels.");
}
