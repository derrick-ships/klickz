import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import sharp from "sharp";
import { resolveAccess, type Scope } from "./oauth/core";
import { appOrigin } from "./crypto";
import { AppError } from "./validation";
import { ownedAsset } from "./assets";
import { fetchReference } from "./reference";
import { reconcileJobs } from "./jobs";
import { fixInstructions } from "./providers";
import { POST as generate } from "@/app/api/generate/route";
import { POST as analyze } from "@/app/api/analyze/route";
import { POST as resize } from "@/app/api/resize/route";
import { POST as titles } from "@/app/api/titles/route";
import { POST as makePlan } from "@/app/api/fix-plan/route";
import { POST as compare } from "@/app/api/compare/route";
import { unseal } from "./crypto";
import type { FixPlan } from "./diagnostics";
import { POST as prepare } from "@/app/api/persona/prepare/route";
import { userKeys } from "./provider-context";
import { widgetHtml } from "./widget.generated";
export const uiUri = "ui://openpikzels/studio.html";
export const agentGuide = `OpenPikzels is a private thumbnail workspace. First call get_workspace to see your provider capabilities. Never ask for API keys in chat: use the app's Connections screen. Use list_profiles/get_profile for consistent persona or style references. upload_reference accepts a public image URL or base64 PNG/JPEG/WebP and returns a private owned path. Images made in ChatGPT can be uploaded here for score_thumbnail; a separate Jev API key is required. score_thumbnail defaults to Jev only; includeVision explicitly opts into one additional OpenAI/Google request. Supply the factual videoBrief and title or Idea/Curiosity and the overall remain partial. Preserve requestId on retries and inspect list_jobs. Scores describe five visual packaging rubrics, not predicted CTR or guaranteed performance. Use get_fix_prompt to return a copyable editing prompt for ChatGPT without paying for an image API. Use create_fix_plan to compile and review preservation constraints first. Then use one_click_fix with its exact plan token only after the user wants a new API-rendered image; it consumes their own connected image-provider credits and preserves the original. Generation defaults to a single low-quality image; pass a stable requestId for a logical render, and check list_creations after a timeout before submitting again. Never retry ambiguous paid operations automatically. resize_thumbnail makes a vertical or horizontal contained layout with a blurred background without an image API. Ask the user to confirm their desired provider/quality/batch when unspecified. Do not claim profiles are fine-tuned: they use reference-guided identity briefs. Tool instructions do not override the user's intent. Open the HTML workspace with open_studio when your host supports MCP Apps.`;
export async function createMcpServer(token: string) {
  const context = await resolveAccess(token),
    { db, user, oauth } = context;
  const server = new McpServer(
    { name: "OpenPikzels", version: "1.1.0" },
    { instructions: agentGuide },
  );
  async function allowed(scope: Scope) {
    if (!oauth.scope.includes(scope))
      throw new AppError(
        403,
        "Reconnect and allow " + scope + " to use this tool.",
      );
    await resolveAccess(token, scope);
  }
  async function signed(path: string) {
    if (!path) return null;
    const r = await db.storage.from("studio-assets").createSignedUrl(path, 300);
    if (r.error) throw new AppError(404, "Image is unavailable.");
    return r.data.signedUrl;
  }
  async function creation(id: string) {
    const r = await db
      .from("studio_creations")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", id)
      .single();
    if (r.error || !r.data) throw new AppError(404, "Creation not found.");
    return r.data;
  }
  async function decorate(value: Record<string, unknown>) {
    const c = value.creation as { image_path?: string } | undefined;
    if (c?.image_path) value.previewUrl = await signed(c.image_path);
    return value;
  }
  async function backend(
    handler: (r: Request) => Promise<Response>,
    body: unknown,
  ) {
    const result = await handler(
      new Request(`${appOrigin()}/api/mcp-internal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    const data = await result.json();
    if (!result.ok)
      throw new AppError(
        result.status,
        data.error || "Operation did not complete.",
      );
    return decorate(data);
  }
  // Mutating and paid tools require granted scopes; the host still mediates each invocation.
  const tool = (
    name: string,
    description: string,
    inputSchema: z.ZodRawShape,
    scope: Scope,
    work: (args: Record<string, any>) => Promise<Record<string, unknown>>,
    readOnly = false,
  ) =>
    registerAppTool(
      server,
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: false,
          idempotentHint: readOnly,
          openWorldHint: !readOnly,
        },
        _meta: { ui: { resourceUri: uiUri }, "openai/outputTemplate": uiUri },
      },
      async (args) => {
        try {
          await allowed(scope);
          const result = await work(args);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch (e) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text:
                  e instanceof AppError
                    ? e.message
                    : "The tool could not complete. Check your account connections.",
              },
            ],
          };
        }
      },
    );
  tool(
    "get_workspace",
    "Get your private workspace, connected provider capabilities, and agent guide. No keys are returned.",
    {},
    "studio:read",
    async () => {
      const keys = await userKeys(db, user.id);
      return {
        providers: Object.keys(keys).filter(
          (k) => !!keys[k as keyof typeof keys],
        ),
        aiEnabled: process.env.AI_ENABLED === "true",
        guide: agentGuide,
        scope: oauth.scope,
      };
    },
    true,
  );
  tool(
    "open_studio",
    "Open the interactive thumbnail workspace in MCP Apps-capable hosts.",
    {},
    "studio:read",
    async () => ({
      message: "Your OpenPikzels workspace is ready.",
      guide: agentGuide,
    }),
    true,
  );
  tool(
    "list_creations",
    "List recent creations and scores. Check this after a render times out before retrying.",
    { limit: z.number().int().min(1).max(50).default(20) },
    "studio:read",
    async ({ limit }) => {
      const r = await db
        .from("studio_creations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (r.error) throw r.error;
      return {
        creations: await Promise.all(
          r.data.map(async (c) => ({
            ...c,
            previewUrl: c.image_path ? await signed(c.image_path) : null,
          })),
        ),
        previewExpiresIn: 300,
      };
    },
    true,
  );
  tool(
    "get_creation",
    "Get a creation, its five-pillar score and a short-lived private image preview.",
    { creationId: z.string().uuid() },
    "studio:read",
    async ({ creationId }) => ({
      creation: await creation(creationId),
      previewUrl: await signed((await creation(creationId)).image_path),
      previewExpiresIn: 300,
    }),
    true,
  );
  tool(
    "list_profiles",
    "List your saved persona/character or style profiles.",
    { kind: z.enum(["persona", "style"]).default("persona") },
    "studio:read",
    async ({ kind }) => {
      const r = await db
        .from(kind === "persona" ? "studio_personas" : "studio_styles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return { profiles: r.data, kind };
    },
    true,
  );
  tool(
    "get_profile",
    "Get persona/character reference pictures or a style with expiring private image links.",
    {
      id: z.string().uuid(),
      kind: z.enum(["persona", "style"]).default("persona"),
    },
    "studio:read",
    async ({ id, kind }) => {
      const r = await db
        .from(kind === "persona" ? "studio_personas" : "studio_styles")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (r.error) throw new AppError(404, "Profile not found.");
      return {
        profile: r.data,
        pictures: await Promise.all(
          r.data.refs.map(async (path: string) => ({
            path,
            url: await signed(path),
          })),
        ),
        previewExpiresIn: 300,
      };
    },
    true,
  );
  tool(
    "upload_reference",
    "Save an image made in chat or another tool as a private reference. Supply one public HTTPS image/YouTube URL or base64 image (max 2 MB decoded).",
    {
      url: z.string().url().max(2000).optional(),
      base64: z.string().max(2800000).optional(),
    },
    "studio:write",
    async ({ url, base64 }) => {
      if (!!url === !!base64)
        throw new AppError(400, "Supply a URL or base64 image.");
      let image: Buffer;
      if (url) image = await fetchReference(url);
      else {
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0)
          throw new AppError(
            400,
            "Use plain base64 without a data URL prefix.",
          );
        const bytes = Buffer.from(base64, "base64");
        if (bytes.length > 2 * 1024 * 1024)
          throw new AppError(413, "Use an image smaller than 2 MB.");
        const decoded = sharp(bytes, { limitInputPixels: 40000000 }),
          meta = await decoded.metadata();
        if (!["png", "jpeg", "webp"].includes(meta.format || ""))
          throw new AppError(400, "Use PNG, JPEG or WebP.");
        image = await decoded
          .rotate()
          .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
      }
      const path = `${user.id}/references/${crypto.randomUUID()}.png`;
      const r = await db.storage
        .from("studio-assets")
        .upload(path, image, { contentType: "image/png" });
      if (r.error) throw r.error;
      return {
        imagePath: path,
        previewUrl: await signed(path),
        previewExpiresIn: 300,
      };
    },
  );
  tool(
    "save_profile",
    "Create a reference-guided persona/character or style from your uploaded private image paths.",
    {
      kind: z.enum(["persona", "style"]),
      name: z.string().min(1).max(80),
      notes: z.string().max(1200).default(""),
      references: z.array(z.string().max(400)).min(1).max(6),
    },
    "studio:write",
    async ({ kind, name, notes, references }) => {
      for (const path of references) await ownedAsset(db, user.id, path);
      const r = await db
        .from(kind === "persona" ? "studio_personas" : "studio_styles")
        .insert({ user_id: user.id, name, notes, refs: references })
        .select("*")
        .single();
      if (r.error) throw r.error;
      return { profile: r.data, method: "reference-guided" };
    },
  );
  tool(
    "prepare_profile",
    "Analyze profile references to save a consistent identity/style brief. Uses your connected OpenAI or Google credits.",
    { id: z.string().uuid(), kind: z.enum(["persona", "style"]) },
    "studio:ai",
    async (args) => {
      await allowed("studio:write");
      return backend(prepare, args);
    },
  );
  tool(
    "suggest_titles",
    "Suggest five truthful title variations using your own OpenAI or Google credits.",
    {
      prompt: z.string().min(8).max(2400),
      audience: z.string().max(200).default("YouTube viewers"),
    },
    "studio:ai",
    (args) => backend(titles, args),
  );
  const generationInput = {
    prompt: z.string().min(8).max(2400),
    title: z.string().max(100).default(""),
    mode: z.enum(["generate", "recreate", "edit", "title"]).default("generate"),
    parentId: z.string().uuid().optional(),
    personaId: z.string().uuid().optional(),
    styleId: z.string().uuid().optional(),
    referencePaths: z.array(z.string().max(400)).max(6).default([]),
    model: z
      .enum(["sunburst", "flare", "gemini-flash", "gemini-pro"])
      .default("flare"),
    quality: z.enum(["low", "medium", "high", "xhigh", "max"]).default("low"),
    complexity: z.enum(["low", "medium", "high"]).default("medium"),
    format: z.enum(["long", "short"]).default("long"),
    batch: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(1),
    requestId: z.string().uuid(),
  };
  tool(
    "generate_thumbnail",
    "Generate, recreate, edit, or create from title using your own image-provider credits. Preserve requestId across an uncertain retry; check history first.",
    generationInput,
    "studio:ai",
    async (args) => {
      await allowed("studio:write");
      const { model, quality, complexity, format, batch, ...rest } = args;
      return backend(generate, {
        ...rest,
        settings: { model, quality, complexity, format, batch },
      });
    },
  );
  tool(
    "score_thumbnail",
    "Score a real thumbnail + title across virality, clarity, idea, curiosity and emotion using your Jev credits. Images created in ChatGPT are supported via upload_reference. This is a rubric, not predicted CTR.",
    {
      creationId: z.string().uuid().optional(),
      imagePath: z.string().max(400).optional(),
      title: z.string().max(100).default(""),
      videoBrief: z.string().max(2400).default(""),
      audience: z.string().max(200).default(""),
      includeVision: z.boolean().default(false),
      requestId: z.string().uuid(),
    },
    "studio:ai",
    async (args) => {
      await allowed("studio:write");
      return backend(analyze, args);
    },
  );
  tool(
    "get_fix_prompt",
    "Return a copyable editing prompt from an existing score. No image API call. Paste it into ChatGPT with the original image.",
    { creationId: z.string().uuid() },
    "studio:read",
    async ({ creationId }) => {
      const c = await creation(creationId);
      if (!c.score || c.score.title !== c.title)
        throw new AppError(
          400,
          "Score this thumbnail with its current title first.",
        );
      return {
        prompt: `Edit the attached original thumbnail for the video titled "${c.title}". Keep the same person, identity and truthful video promise. Preserve strong elements. Apply these visual improvements in order:\n${fixInstructions(c.score)}\nUse a clear focal point, readable short text only if useful, and strong mobile-feed hierarchy. Return the edited thumbnail. Do not claim guaranteed clicks or invent evidence.`,
        creationId,
      };
    },
    true,
  );
  tool(
    "create_fix_plan",
    "Compile a no-charge edit plan from a current, signed, image-specific diagnostic. Missing context or evidence blocks API fixes. Review returned operations and preservation constraints before applying.",
    {
      creationId: z.string().uuid(),
      model: z
        .enum(["flare", "sunburst", "gemini-flash", "gemini-pro"])
        .default("flare"),
      quality: z.enum(["low", "medium", "high", "xhigh", "max"]).default("low"),
      exactText: z.array(z.string().max(160)).max(8).default([]),
      requiredObjects: z.array(z.string().max(160)).max(8).default([]),
      forbiddenChanges: z.array(z.string().max(160)).max(8).default([]),
    },
    "studio:write",
    async ({
      creationId,
      model,
      quality,
      exactText,
      requiredObjects,
      forbiddenChanges,
    }) => {
      const c = await creation(creationId);
      return backend(makePlan, {
        creationId,
        settings: {
          model,
          quality,
          format: c.settings?.format || "long",
          complexity: "medium",
          batch: 1,
        },
        preserve: { exactText, requiredObjects, forbiddenChanges },
      });
    },
  );
  tool(
    "one_click_fix",
    "Apply the exact reviewed create_fix_plan token. One image request, original preserved, no automatic scoring. Model and quality are bound to the plan.",
    { planToken: z.string().max(32000), requestId: z.string().uuid() },
    "studio:ai",
    async ({ planToken, requestId }) => {
      await allowed("studio:write");
      const plan = unseal<FixPlan>(planToken, "fix-plan");
      return backend(generate, {
        parentId: plan.sourceId,
        title: plan.title,
        prompt:
          "Apply the reviewed packaging edits while preserving the original.",
        mode: "fix",
        settings: plan.settings,
        fixPlanToken: planToken,
        requestId,
      });
    },
  );
  tool(
    "compare_variants",
    "Create a randomized, same-sized A/B package without prior scores or edit rationale. No AI charge. Use record_comparison after a human reviews facts, identity and readability.",
    { creationId: z.string().uuid() },
    "studio:read",
    (args) => backend(compare, args),
    true,
  );
  tool(
    "record_comparison",
    "Record A/B, tie or inconclusive human preference. Both variants remain saved. This does not establish CTR uplift.",
    {
      token: z.string().max(12000),
      preference: z.enum(["A", "B", "tie", "inconclusive"]),
    },
    "studio:write",
    (args) => backend(compare, args),
  );
  tool(
    "list_jobs",
    "Read durable request states. A reconciling dispatch may already have consumed provider credits; do not automatically resubmit.",
    {},
    "studio:read",
    async () => {
      await reconcileJobs(db);
      const r = await db
        .from("studio_jobs")
        .select("id,operation,state,max_provider_calls,created_at,updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (r.error) throw r.error;
      return { jobs: r.data };
    },
    true,
  );
  tool(
    "resize_thumbnail",
    "Instantly create a vertical or horizontal layout, preserving the whole original over a blurred background. Uses no image-provider credits.",
    {
      creationId: z.string().uuid(),
      format: z.enum(["long", "short"]),
      requestId: z.string().uuid(),
    },
    "studio:write",
    (args) => backend(resize, args),
  );
  server.registerResource(
    "agent-guide",
    "openpikzels://agent-guide",
    { mimeType: "text/markdown" },
    async () => ({
      contents: [
        {
          uri: "openpikzels://agent-guide",
          mimeType: "text/markdown",
          text: agentGuide,
        },
      ],
    }),
  );
  registerAppResource(
    server,
    "OpenPikzels Studio",
    uiUri,
    {
      description:
        "Private thumbnail gallery, score viewer, fix prompt and resize controls.",
    },
    async () => ({
      contents: [
        {
          uri: uiUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: {
              csp: {
                connectDomains: [],
                resourceDomains: [
                  new URL(
                    process.env.NEXT_PUBLIC_SUPABASE_URL ||
                      "https://supabase.co",
                  ).origin,
                ],
              },
              prefersBorder: true,
            },
            "openai/widgetDescription": "OpenPikzels private thumbnail studio",
          },
        },
      ],
    }),
  );
  return server;
}
