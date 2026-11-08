import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import sharp from "sharp";
import { AppError } from "./validation";
export function publicIPv4(ip: string) {
  const a = ip.split(".").map(Number);
  if (a.length !== 4 || a.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;
  const [x, y] = a;
  return !(
    x === 0 ||
    x === 10 ||
    x === 127 ||
    x >= 224 ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    x === 192 ||
    (x === 100 && y >= 64 && y <= 127) ||
    (x === 198 && (y === 18 || y === 19 || y === 51)) ||
    (x === 203 && y === 0)
  );
}
export function referenceURL(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(400, "Paste a valid image or YouTube URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname) ||
    url.hostname === "localhost" ||
    /\.(local|internal|test|lan)$/.test(url.hostname)
  )
    throw new AppError(400, "Use a public HTTPS image URL.");
  const host = url.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1];
  else if (["youtube.com", "m.youtube.com"].includes(host))
    id =
      url.searchParams.get("v") ||
      url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ||
      null;
  if (id) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id))
      throw new AppError(400, "Check the YouTube video URL.");
    url = new URL(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  }
  return url;
}
export async function fetchReference(value: string, hops = 0, allowedHosts?: readonly string[]): Promise<Buffer> {
  if (hops > 3)
    throw new AppError(400, "Too many redirects. Upload the image instead.");
  const url = referenceURL(value);
  if(allowedHosts&&!allowedHosts.includes(url.hostname))throw new AppError(400,"This reference redirected outside its trusted image host.");
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((x) => !publicIPv4(x.address)))
    throw new AppError(400, "This URL is not a public image source.");
  const fetched = await new Promise<{ redirect?: string; body?: Buffer }>(
    (resolve, reject) => {
      const req = https.get(
        url,
        {
          timeout: 15000,
          lookup: ((
            _host: unknown,
            _options: unknown,
            cb: (error: Error | null, address: string, family: number) => void,
          ) => cb(null, addresses[0].address, 4)) as never,
          headers: { Accept: "image/*" },
        },
        (res) => {
          if (
            res.statusCode &&
            [301, 302, 303, 307, 308].includes(res.statusCode) &&
            res.headers.location
          ) {
            res.resume();
            resolve({ redirect: new URL(res.headers.location, url).href });
            return;
          }
          if (
            res.statusCode !== 200 ||
            !res.headers["content-type"]?.startsWith("image/")
          ) {
            res.resume();
            reject(
              new AppError(
                400,
                "The link did not return an image. Upload it instead.",
              ),
            );
            return;
          }
          let length = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            length += chunk.length;
            if (length > 5 * 1024 * 1024) {
              req.destroy();
              reject(new AppError(413, "Reference image exceeds 5 MB."));
            } else chunks.push(chunk);
          });
          res.on("end", () => resolve({ body: Buffer.concat(chunks) }));
          res.on("error", reject);
        },
      );
      req.on("timeout", () => req.destroy(new Error("Image source timed out")));
      req.on("error", reject);
    },
  );
  if (fetched.redirect) return fetchReference(fetched.redirect, hops + 1, allowedHosts);
  return sharp(fetched.body!, { limitInputPixels: 40000000 })
    .rotate()
    .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}
