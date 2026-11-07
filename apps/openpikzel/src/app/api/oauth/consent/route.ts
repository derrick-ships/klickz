import { readAuthorization, readClient, issueCode } from "@/lib/oauth/core";
import { hash, sameOrigin } from "@/lib/crypto";
import { failure } from "@/lib/server";
import { AppError } from "@/lib/validation";
import { limitedJson } from "@/lib/oauth/http";
import { z } from "zod";
export function GET(request: Request) {
  try {
    const auth = readAuthorization(
        new URL(request.url).searchParams.get("request") || "",
      ),
      client = readClient(auth.clientId);
    return Response.json(
      { name: client.name, redirect: auth.redirect, scope: auth.scope },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = z
      .object({
        request: z.string().max(16000),
        decision: z.enum(["allow", "deny"]),
        refreshToken: z.string().max(10000).optional(),
      })
      .parse(await limitedJson(request, 30000));
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("opz_consent="))
      ?.slice(12);
    if (cookie !== hash(input.request))
      throw new AppError(403, "Consent must begin from your agent connection.");
    const auth = readAuthorization(input.request),
      redirect = new URL(auth.redirect);
    if (auth.state) redirect.searchParams.set("state", auth.state);
    if (input.decision === "deny")
      redirect.searchParams.set("error", "access_denied");
    else {
      const access = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/)?.[1];
      if (!access || access.startsWith("opz1.") || !input.refreshToken)
        throw new AppError(401, "Sign in to approve agent access.");
      redirect.searchParams.set(
        "code",
        await issueCode(auth, access, input.refreshToken),
      );
    }
    return Response.json(
      { redirect: redirect.href },
      {
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie":
            "opz_consent=; HttpOnly; SameSite=Lax; Path=/api/oauth/consent; Max-Age=0",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
