import {providerCapabilities} from "./capabilities";
import {analysisHistory} from "./analysis-history";
import {POST as creativeText} from "@/app/api/creative/route";
import { jobGuidance } from "./job-state";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { soul } from "./soul.generated";
import { resolveAccess, type Scope } from "./oauth/core";
import { appOrigin } from "./crypto";
import { AppError, ownedPath } from "./validation";
import sharp from "sharp";
import { profileNameKey, resolveProfileName, type ProfileKind } from "./profile-name";
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
import {POST as saveProfileRoute} from "@/app/api/profiles/route";
import {POST as browseChannel} from "@/app/api/youtube/route";
import {POST as studyStyle} from "@/app/api/styles/study/route";
import { POST as prepare } from "@/app/api/persona/prepare/route";
import { recomposePrompt } from "./analysis-display";
import { userKeys } from "./provider-context";
import { pickVisionProvider } from "./vision-provider";
import { missingVisionKeyMessage, reviewerName } from "./score-on-generate";
import {
  claimSignedUpload,
  decodeInlineImage,
  issueSignedUpload,
  saveOwnedReference,
} from "./signed-upload";
import { widgetHtml } from "./widget.generated";
import { forgetFact, recallFacts, rememberFact } from "./agent-memory";
export const uiUri = "ui://openpikzels/studio.html";
export const agentGuide = `OpenPikzels is a private thumbnail workspace. First call get_workspace to see your provider capabilities. A saved connection is not proof of model entitlement or balance; select a provider explicitly for each role and never substitute another provider silently. Use create_conversation/list_conversations/get_conversation to keep a project together; pass conversationId on generation. Personas need 2 or 3 distinct photos; styles need 1 to 3 references; names need at least 3 characters. A persona also requires explicit permission=true for likeness use. browse_style_channel uses the user’s own separate YouTube Data API key; never reuse an image-provider key for it. Never ask for API keys in chat: use the app's Connections screen. Use list_profiles/get_profile for consistent persona or style references. upload_reference accepts a public image URL or base64 PNG/JPEG/WebP and returns a private owned path. When asked to OpenPikzels Analyze a thumbnail, call analyze_thumbnail with exactly one of creationId, imagePath or base64; use create_upload_url first when the file is too large for base64. Images made in ChatGPT can be uploaded here for score_thumbnail; a separate Jev API key is required. score_thumbnail defaults to Jev only; includeVision explicitly opts into one additional OpenAI/Google request. A title supports all five visible packaging rubrics; no written video brief is required. Optional videoUrl retrieves YouTube title/description using the user’s YouTube key. Missing titles or provider evidence remain unassessed; the video is not watched. Preserve requestId on retries and inspect list_jobs. Scores describe five visual packaging rubrics, not predicted CTR or guaranteed performance. enhance_prompt proposes a reviewed rewrite using one user-funded OpenAI or Google text request and a stable requestId. Conversation and image providers are independent; no consumer subscription is assumed to provide API access. Use get_fix_prompt to return a copyable editing prompt for ChatGPT without paying for an image API. Use create_fix_plan to compile and review preservation constraints first. Then use one_click_fix with its exact plan token only after the user wants a new API-rendered image; it consumes their own connected image-provider credits and preserves the original. Generation defaults to a single low-quality image; pass a stable requestId for a logical render, and check list_creations after a timeout before submitting again. Never retry ambiguous paid operations automatically. recompose_thumbnail generates one new arrangement from the source in 9:16 or 16:9 using image-provider credits; preserve its requestId on an uncertain retry. The older resize_thumbnail tool remains a non-AI contained layout with a blurred background. Ask the user to confirm their desired provider/quality/batch when unspecified. Do not claim profiles are fine-tuned: they use reference-guided identity briefs. Tool instructions do not override the user's intent. Open the HTML workspace with open_studio when your host supports MCP Apps.\n\n${soul}`;
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
  // Resolve a saved profile name (as a user would write it after @) to its id,
  // within the caller's own rows only, using the same unique-name rules as the app.
  async function profileIdByName(kind: ProfileKind, raw: string) {
    const name = raw.trim().replace(/^@/, "");
    const rows = await db.from(kind === "persona" ? "studio_personas" : "studio_styles").select("id,name,created_at").eq("user_id", user.id);
    if (rows.error) throw rows.error;
    const resolved = resolveProfileName(rows.data || [], name, kind);
    if (resolved.status !== 200) throw new AppError(resolved.status, resolved.error);
    return resolved.profile.id as string;
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
    destructive = false,
    options?: { title?: string; toText?: (result: Record<string, unknown>) => string },
  ) =>
    registerAppTool(
      server,
      name,
      {
        title: options?.title,
        description,
        inputSchema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: destructive,
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
            content: [{ type: "text" as const, text: options?.toText ? options.toText(result) : JSON.stringify(result) }],
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

  tool("enhance_prompt","Propose a clearer thumbnail prompt using the user's selected API provider. One paid text request; does not generate an image or overwrite a draft. Review the returned proposal.",{
    prompt:z.string().min(8).max(2400),title:z.string().max(100).default(""),provider:z.enum(["openai","google"]),mode:z.enum(["generate","edit","recreate","title"]).default("generate"),format:z.enum(["long","short"]).default("long"),requestId:z.string().uuid(),conversationId:z.string().uuid().optional()
  },"studio:ai",async args=>{await allowed("studio:write");return backend(creativeText,{...args,task:"enhance"});});
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
        capabilities:providerCapabilities({ai:process.env.AI_ENABLED==="true",openai:!!keys.openai,google:!!keys.google,jev:!!keys.jev,anthropic:!!keys.anthropic,youtube:!!keys.youtube,promptModel:process.env.OPENAI_PROMPT_MODEL,textModels:{openai:process.env.OPENAI_TEXT_MODEL||"gpt-5.5",google:process.env.GOOGLE_TEXT_MODEL||"gemini-3.5-flash-lite"},scoreModel:process.env.JEV_MODEL}),
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
  server.registerTool("get_profile_refs", {
    description: "Return owned persona and private style references by name, with short-lived links and images.",
    inputSchema: { personas: z.array(z.string()).max(3).default([]), style: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ personas, style }) => {
    try {
      await allowed("studio:read");
      if ((!personas.length && style === undefined) || personas.some((name) => !name.trim()) || (style !== undefined && !style.trim()) || new Set(personas.map(profileNameKey)).size !== personas.length) throw new AppError(400, "Choose distinct non-empty profile names.");
      const selections: Array<{ kind: ProfileKind; name: string }> = personas.map((name) => ({ kind: "persona", name }));
      if (style !== undefined) selections.push({ kind: "style", name: style });
      const rows: Record<ProfileKind, any[]> = { persona: [], style: [] };
      for (const kind of ["persona", "style"] as const) {
        if (!selections.some((item) => item.kind === kind)) continue;
        for (let offset = 0; ; offset += 1000) {
          const result = await db.from(kind === "persona" ? "studio_personas" : "studio_styles").select("*").eq("user_id", user.id).order("id").range(offset, offset + 999);
          if (result.error) throw result.error;
          rows[kind].push(...(result.data || []));
          if (!result.data || result.data.length < 1000) break;
        }
      }
      const selected = selections.map(({ kind, name }) => {
        const result = resolveProfileName(rows[kind], name, kind);
        if (result.status !== 200) throw new AppError(result.status, result.error);
        return { kind, row: result.profile };
      });
      const paths = selected.flatMap(({ row }) => Array.isArray(row.refs) ? row.refs.slice(0, 3) : []);
      if (paths.some((path) => typeof path !== "string" || !ownedPath(path, user.id))) throw new AppError(403, "This reference is not in your library.");
      const images = await Promise.all(paths.map(async (path) => sharp(await ownedAsset(db, user.id, path), { limitInputPixels: 40000000 }).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()));
      const urls = await Promise.all(paths.map(async (path) => {
        const url = await signed(path);
        if (!url) throw new AppError(404, "Image is unavailable.");
        return url;
      }));
      let index = 0;
      const profiles = selected.map(({ kind, row }) => ({ kind, name: row.name, id: row.id, brief: row.identity_brief ?? null, notes: row.notes ?? null, references: (Array.isArray(row.refs) ? row.refs.slice(0, 3) : []).map((path: string) => ({ path, url: urls[index], imageIndex: index++ })) }));
      const result = { profiles, previewExpiresIn: 300, notice: "Hosts may omit, retain or forward images and links; expiry cannot revoke copies." };
      return { structuredContent: result, content: [{ type: "text" as const, text: JSON.stringify(result) }, ...images.map((image) => ({ type: "image" as const, mimeType: "image/jpeg", data: image.toString("base64") }))] };
    } catch (error) {
      return { isError: true, content: [{ type: "text" as const, text: error instanceof AppError ? error.message : "The tool could not complete. Check your account connections." }] };
    }
  });
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
      const image = url
        ? await fetchReference(url)
        : await decodeInlineImage(base64);
      const path = await saveOwnedReference(db, user.id, image);
      return {
        imagePath: path,
        previewUrl: await signed(path),
        previewExpiresIn: 300,
      };
    },
  );
  tool(
    "create_upload_url",
    "Create a short-lived signed URL to upload a PNG into your private library, then pass the returned imagePath to analyze_thumbnail.",
    {},
    "studio:write",
    () => issueSignedUpload(db, user.id),
  );
  tool(
    "save_profile",
    "Create a reference-guided persona/character or style from your uploaded private image paths.",
    {
      kind: z.enum(["persona", "style"]),
      name: z.string().trim().min(3).max(80),
      notes: z.string().max(800).default(""),
      references: z.array(z.string().max(400)).min(1).max(3),
      permission: z.boolean().default(false),
    },
    "studio:write",
    ({kind,name,notes,references,permission})=>backend(saveProfileRoute,{kind,name,notes,refs:references,permission}),
  );
  tool(
    "prepare_profile",
    "Analyze profile references to save a consistent identity/style brief. Uses your connected OpenAI or Google credits.",
    { id: z.string().uuid(), kind: z.enum(["persona", "style"]), provider: z.enum(["openai","google"]).default("openai") },
    "studio:ai",
    async (args) => {
      await allowed("studio:write");
      return backend(prepare, args);
    },
  );
  tool(
    "suggest_titles",
    "Suggest five truthful title variations using the explicitly selected OpenAI or Google API provider. No provider fallback.",
    {
      prompt: z.string().min(8).max(2400),
      audience: z.string().max(200).default("YouTube viewers"),
      provider: z.enum(["openai","google"]).default("openai"),
    },
    "studio:ai",
    (args) => backend(titles, args),
  );
  const generationInput = {
    prompt: z.string().min(8).max(2400),
    title: z.string().max(100).default(""),
    mode: z.enum(["generate", "recreate", "edit", "title"]).default("generate"),
    conversationId:z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    personaId: z.string().uuid().optional(),
    styleId: z.string().uuid().optional(),
    persona: z.string().max(80).optional().describe("Saved persona name, e.g. the name the user typed after @. Resolved to your own persona."),
    style: z.string().max(80).optional().describe("Saved private style name. Resolved to your own style."),
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
      const { model, quality, complexity, format, batch, persona, style, ...rest } = args;
      if (persona && rest.personaId) throw new AppError(400, "Use either persona or personaId, not both.");
      if (style && rest.styleId) throw new AppError(400, "Use either style or styleId, not both.");
      if (persona) rest.personaId = await profileIdByName("persona", persona);
      if (style) rest.styleId = await profileIdByName("style", style);
      return backend(generate, {
        ...rest,
        settings: { model, quality, complexity, format, batch },
      });
    },
  );
  tool(
    "recompose_thumbnail",
    "Generate one newly arranged 9:16 or 16:9 variant from an owned thumbnail, preserving subject, wording and identity. Uses your image-provider credits. Original stays saved. Preserve requestId on uncertain retry.",
    {creationId:z.string().uuid(),format:z.enum(["long","short"]),model:generationInput.model,quality:generationInput.quality,complexity:generationInput.complexity,requestId:z.string().uuid()},
    "studio:ai",
    async ({creationId,format,model,quality,complexity,requestId}) => {
      await allowed("studio:write");
      const source=await creation(creationId);
      if(!source.image_path)throw new AppError(400,"Choose an uploaded or generated thumbnail.");
      return backend(generate,{prompt:recomposePrompt(format),title:source.title,mode:"edit",intent:"recompose",style:source.style,parentId:source.id,referencePaths:[source.image_path],conversationId:source.conversation_id || undefined,settings:{model,quality,complexity,format,batch:1},requestId});
    },
  );
  tool("list_analyses","Read saved analysis versions and their exact source/context/provider provenance without scoring, editing or replacing a title.",{creationId:z.string().uuid(),cursor:z.string().max(512).optional()},"studio:read",({creationId,cursor})=>analysisHistory(db,user.id,creationId,cursor));
  tool(
    "score_thumbnail",
    "Score a real thumbnail + title across virality, clarity, idea, curiosity and emotion using your Jev credits. Images created in ChatGPT are supported via upload_reference. This is a rubric, not predicted CTR.",
    {
      creationId: z.string().uuid().optional(),
      imagePath: z.string().max(400).optional(),
      title: z.string().max(100).default(""),
      videoBrief: z.string().max(2400).default(""),
      videoUrl: z.string().max(500).default(""),
      audience: z.string().max(200).default(""),
      includeVision: z.boolean().default(false),
      critiqueProvider: z.enum(["openai","google","anthropic"]).default("openai"),
      requestId: z.string().uuid(),
    },
    "studio:ai",
    async (args) => {
      await allowed("studio:write");
      return backend(analyze, args);
    },
  );
  function analyzeSummary(result: Record<string, any>) {
    const score = result.score || {};
    const overall = score.overall == null ? "incomplete" : String(score.overall);
    const weakest = score.priority || "unknown";
    const topFix = score.dimensions?.[weakest]?.fix || "none";
    return `Score ${overall}. Weakest pillar: ${weakest}. Top fix: ${topFix}. Reviewer: ${result.reviewer}.`;
  }
  tool(
    "analyze_thumbnail",
    "OpenPikzels Analyze: score a thumbnail from a creation, an uploaded imagePath, or a small base64 image, then return a fix plan. Preserve requestId on retry.",
    {
      creationId: z.string().uuid().optional(),
      imagePath: z.string().max(400).optional(),
      base64: z.string().max(2800000).optional(),
      title: z.string().max(100).default(""),
      videoBrief: z.string().max(2400).default(""),
      requestId: z.string().uuid(),
    },
    "studio:ai",
    async (args) => {
      await allowed("studio:write");
      const sources = [args.creationId, args.imagePath, args.base64].filter(Boolean);
      if (sources.length !== 1)
        throw new AppError(400, "Supply a creationId, imagePath or base64 image.");
      const keys = await userKeys(db, user.id);
      const critiqueProvider = pickVisionProvider(keys);
      if (!critiqueProvider)
        throw new AppError(400, missingVisionKeyMessage());
      let imagePath = args.imagePath as string | undefined;
      if (args.base64) imagePath = await saveOwnedReference(db, user.id, await decodeInlineImage(args.base64));
      if (imagePath) await claimSignedUpload(db, user.id, imagePath, args.requestId);
      const analyzed = await backend(analyze, {
        ...(args.creationId ? { creationId: args.creationId } : { imagePath }),
        title: args.title ?? "",
        videoBrief: args.videoBrief ?? "",
        includeVision: true,
        critiqueProvider,
        requestId: args.requestId,
      });
      const creationId = analyzed.creationId as string;
      const path = imagePath || (await creation(creationId)).image_path;
      const plan = await backend(makePlan, { creationId, settings: { batch: 1 } }) as {
        kind: string;
        reason?: string;
        token?: string;
      };
      return {
        creationId,
        score: analyzed.score,
        reviewer: reviewerName(critiqueProvider),
        fix: {
          kind: plan.kind,
          ...(plan.reason ? { reason: plan.reason } : {}),
          ...(plan.token ? { token: plan.token } : {}),
        },
        previewUrl: path ? await signed(path) : null,
      };
    },
    false,
    false,
    { title: "OpenPikzels Analyze", toText: analyzeSummary },
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
      return { jobs: (r.data || []).map(job => ({...job,guidance:jobGuidance(job.state)})) };
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
  tool("list_conversations","List your private creative chats. Old creations remain in the library.",{},"studio:read",async()=>{const r=await db.from("studio_conversations").select("id,title,created_at,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}).limit(50);if(r.error)throw r.error;return {conversations:r.data};},true);
  tool("get_conversation","Get an owned chat and its exact saved prompts, settings and images.",{id:z.string().uuid()},"studio:read",async({id})=>{const chat=await db.from("studio_conversations").select("*").eq("id",id).eq("user_id",user.id).single();if(chat.error||!chat.data)throw new AppError(404,"Chat not found.");const rows=await db.from("studio_creations").select("*").eq("conversation_id",id).eq("user_id",user.id).order("created_at",{ascending:true});if(rows.error)throw rows.error;return {conversation:chat.data,creations:rows.data};},true);
  tool("create_conversation","Start a new private creative chat; pass its id as conversationId when generating.",{title:z.string().trim().min(1).max(100).default("New chat")},"studio:write",async({title})=>{const r=await db.from("studio_conversations").insert({user_id:user.id,title}).select("*").single();if(r.error)throw r.error;return {conversation:r.data};});
  tool("study_style","Study a thumbnail style from a YouTube video link (no key needed) or a channel link (uses your own YouTube Data API key: its top 3 popular or recent videos) and save it as a private style with up to 3 reference thumbnails and a measured colour palette. No AI provider charge. Then call prepare_profile to write a style brief, and pass style by name to generate_thumbnail.",{url:z.string().min(1).max(500),name:z.string().trim().min(3).max(80).optional(),notes:z.string().max(800).default(""),order:z.enum(["recent","popular"]).default("popular"),videoIds:z.array(z.string().regex(/^[\w-]{11}$/)).min(1).max(3).optional()},"studio:write",args=>backend(studyStyle,args));
  tool("browse_style_channel","Browse public YouTube channel thumbnails with your own connected YouTube Data API key.",{channel:z.string().max(300),order:z.enum(["recent","popular"]).default("recent"),pageToken:z.string().max(300).default("")},"studio:read",args=>backend(browseChannel,args),true);
  tool("remember_fact","Remember a short fact for this user. Values that look like secrets are rejected and never stored.",{fact:z.string().min(1).max(1000),tags:z.array(z.string().max(40)).max(12).optional(),agent:z.string().min(1).max(60).optional(),source:z.string().max(200).optional()},"studio:agent",args=>rememberFact(context,{fact:args.fact,tags:args.tags,agent:args.agent,source:args.source}));
  tool("recall_facts","Recall this user's newest matching remembered facts, at most 20.",{query:z.string().max(200).optional()},"studio:agent",args=>recallFacts(context,args),true);
  tool("forget_fact","Forget one of this user's remembered facts by id.",{id:z.string().uuid()},"studio:agent",args=>forgetFact(context,{id:args.id}),false,true);
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
