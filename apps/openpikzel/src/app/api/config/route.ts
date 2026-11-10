import {defaultPromptModel} from "@/lib/instructions";
import { publicSupabaseConfig } from "@/lib/config";
import { mcpResource } from "@/lib/crypto";
import { authenticated } from "@/lib/server";
export async function GET(request: Request) {
  const db = publicSupabaseConfig();
  let openai = false,
    jev = false,
    google = false,
    anthropic = false;
  if (request.headers.get("authorization")) {
    try {
      const context = await authenticated(request);
      const rows = await context.db
        .from("studio_provider_keys")
        .select("provider")
        .eq("user_id", context.user.id);
      for (const row of rows.data || []) {
        if (row.provider === "openai") openai = true;
        if (row.provider === "jev") jev = true;
        if (row.provider === "google") google = true;
        if (row.provider === "anthropic") anthropic = true;
      }
      if (process.env.OWNER_PROVIDER_KEYS === "true") {
        const owner = await context.db.rpc("app_web_access");
        if (owner.data === true) {
          openai ||= !!process.env.OPENAI_API_KEY;
          jev ||= !!process.env.JEV_API_KEY;
        }
      }
    } catch {}
  }
  return Response.json(
    {
      mcpUrl: mcpResource(),
      textModels: {openai: process.env.OPENAI_TEXT_MODEL || "gpt-5.5", google: process.env.GOOGLE_TEXT_MODEL || "gemini-3.5-flash-lite"},
      promptModel: process.env.OPENAI_PROMPT_MODEL || defaultPromptModel,
      scoreModel: process.env.JEV_MODEL || "jev-latest",
      codexDevice: process.env.CODEX_DEVICE_ENABLED === "true",
      higgsfield: process.env.HIGGSFIELD_ENABLED === "true",
      cloud: !!db,
      ownerGate: process.env.OWNER_GATE !== "false",
      ai: process.env.AI_ENABLED === "true",
      openai,
      jev,
      google,
      anthropic,
      secureConnections: /^[a-f0-9]{64}$/i.test(
        process.env.STUDIO_ENCRYPTION_KEY || "",
      ),
      supabaseUrl: db?.url || "",
      supabaseKey: db?.key || "",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
