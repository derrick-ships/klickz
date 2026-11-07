import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";
import { appOrigin } from "@/lib/crypto";
import { AppError } from "@/lib/validation";
import { limitedJson } from "@/lib/oauth/http";
export const runtime = "nodejs";
export const maxDuration = 300;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,GET,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization,Content-Type,Accept,MCP-Protocol-Version,Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate,MCP-Protocol-Version",
  "Cache-Control": "no-store",
};
async function handle(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== appOrigin())
    return new Response("Origin not allowed", { status: 403, headers: cors });
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (opz1\..+)$/)?.[1];
  if (!token)
    return new Response(null, {
      status: 401,
      headers: {
        ...cors,
        "WWW-Authenticate": `Bearer resource_metadata="${appOrigin()}/.well-known/oauth-protected-resource/mcp"`,
      },
    });
  try {
    const server = await createMcpServer(token);
    if (request.method !== "POST") {
      await server.close();
      return new Response(null, {
        status: 405,
        headers: { ...cors, Allow: "POST,OPTIONS" },
      });
    }
    const body = await limitedJson(request, 3500000);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(request, {
        parsedBody: body,
      });
      for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
      return response;
    } finally {
      await transport.close();
      await server.close();
    }
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "The MCP request could not complete.",
      },
      {
        status: e instanceof AppError ? e.status : 400,
        headers: {
          ...cors,
          ...(e instanceof AppError && e.status === 401
            ? {
                "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${appOrigin()}/.well-known/oauth-protected-resource/mcp"`,
              }
            : {}),
        },
      },
    );
  }
}
export const POST = handle;
export const GET = handle;
export const DELETE = handle;
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
