import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import {
  channelIngestRequested,
  inngest,
  studyTriangulateRequested,
} from "@/inngest/client";
import { chatFileSchema, fetchChatFile } from "./chat-file";
import { appOrigin } from "./crypto";
import { defaultDiagnosticQuestions } from "./default-questions";
import {
  imageGenerators,
  modelPreferencesSchema,
  readModelPreferences,
  resolveAlias,
  scorers,
  textAliases,
} from "./model-preferences";
import { saveUserModelPreferences } from "./save-model-preferences";
import type { Scope } from "./oauth/core";
import type { ProfileKind } from "./profile-name";
import { userKeys } from "./provider-context";
import { fetchReference } from "./reference";
import { renderReportMarkdown } from "./reports/render-markdown";
import { sendPreFlightReportEmail } from "./reports/send-report-email";
import { mindArchetypes } from "./schemas/audience";
import {
  diagnosticQuestionSchema,
  extractOpening60s,
  productionModeSchema,
  type ReportOptionSnapshot,
  type ReportPayload,
} from "./schemas/study";
import { decodeInlineImage, saveOwnedReference } from "./signed-upload";
import { estimateStudyCost } from "./study-cost";
import { defaultSettings } from "./types";
import { AppError, ownedPath } from "./validation";
import { channelIdentifier } from "./youtube";

export type ToolRegistrar = (
  name: string,
  description: string,
  inputSchema: z.ZodRawShape,
  scope: Scope,
  work: (args: Record<string, any>) => Promise<Record<string, unknown>>,
  readOnly?: boolean,
  destructive?: boolean,
  options?: {
    title?: string;
    toText?: (result: Record<string, unknown>) => string;
    ui?: boolean;
    uiInvoking?: string;
    uiInvoked?: string;
    fileParams?: string[];
  },
) => unknown;

export interface PreflightMcpDeps {
  server: McpServer;
  db: SupabaseClient;
  user: User;
  allowed: (scope: Scope) => Promise<void>;
  signed: (path: string, ttlSeconds?: number) => Promise<string | null>;
  profileIdByName: (kind: ProfileKind, raw: string) => Promise<string>;
  tool: ToolRegistrar;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPreflightWorkspaceSummary(
  db: SupabaseClient,
  user: User,
) {
  const [chRes, audRes, personaRes, studyRes, runRes] = await Promise.all([
    db
      .from("channels")
      .select("id,title,handle,primary_language,subscriber_count")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20),
    db
      .from("audiences")
      .select("id,channel_id,version,language,status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
    db
      .from("studio_personas")
      .select("id,name,profile_status,tone_of_voice,visual_style_rules")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("studies")
      .select("id,title_draft,production_mode,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("study_runs")
      .select("id,study_id,status,progress_pct,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const latestAudByChannel = new Map<
    string,
    { id: string; status: string; version: number; language: string }
  >();
  for (const a of audRes.data || []) {
    if (!latestAudByChannel.has(a.channel_id)) {
      latestAudByChannel.set(a.channel_id, a);
    }
  }
  const readyAudiences = [...latestAudByChannel.values()].filter(
    (a) => a.status === "ready",
  ).length;
  const activeRuns = (runRes.data || []).filter(
    (r) => !["completed", "failed"].includes(r.status),
  ).length;

  return {
    dashboardUrl: appOrigin(),
    models: readModelPreferences(user.user_metadata),
    emailDeliveryConfigured: !!process.env.RESEND_API_KEY,
    backgroundWorkersConfigured: !!(
      process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY
    ),
    counts: {
      channels: (chRes.data || []).length,
      readyAudiences,
      personas: (personaRes.data || []).length,
      recentStudies: (studyRes.data || []).length,
      activeStudyRuns: activeRuns,
    },
    channels: (chRes.data || []).slice(0, 8).map((c) => {
      const aud = latestAudByChannel.get(c.id);
      return {
        id: c.id,
        title: c.title,
        handle: c.handle,
        language: c.primary_language,
        audienceId: aud?.id ?? null,
        audienceStatus: aud?.status ?? null,
      };
    }),
    personas: (personaRes.data || []).slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      status: p.profile_status ?? "draft",
      hasToneOfVoice: !!p.tone_of_voice,
      hasVisualStyleRules: !!p.visual_style_rules,
    })),
  };
}

export function registerPreflightMcp(deps: PreflightMcpDeps) {
  const { server, db, user, allowed, signed, profileIdByName, tool } = deps;

  async function signPaths(
    paths: (string | null | undefined)[],
    ttlSeconds = 3600,
  ): Promise<Record<string, string>> {
    const unique = [...new Set(paths.filter((p): p is string => !!p))];
    if (!unique.length) return {};
    const res = await db.storage
      .from("studio-assets")
      .createSignedUrls(unique, ttlSeconds);
    if (res.error || !res.data) return {};
    return Object.fromEntries(
      res.data
        .filter((item) => item.path && item.signedUrl)
        .map((item) => [item.path!, item.signedUrl!]),
    );
  }

  async function resolveChannelRecord(input: string) {
    const trimmed = input.trim();
    if (UUID_RE.test(trimmed)) {
      const res = await db
        .from("channels")
        .select("*")
        .eq("id", trimmed)
        .eq("user_id", user.id)
        .maybeSingle();
      if (res.data) return res.data;
    }
    const normalizedHandle = trimmed.replace(/^@/, "").toLowerCase();
    const all = await db
      .from("channels")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (all.error) throw all.error;
    const match = (all.data || []).find(
      (c) =>
        c.youtube_channel_id === trimmed ||
        (c.handle &&
          c.handle.replace(/^@/, "").toLowerCase() === normalizedHandle) ||
        c.title.toLowerCase() === trimmed.toLowerCase() ||
        c.title.toLowerCase().includes(trimmed.toLowerCase()),
    );
    if (!match) {
      throw new AppError(
        404,
        `Channel "${input}" not found. Call list_channels to see linked channels or connect_channel to link a new one.`,
      );
    }
    return match;
  }

  async function resolveReportRow(params: {
    slug?: string;
    studyRunId?: string;
    studyId?: string;
  }) {
    if (params.slug) {
      const res = await db
        .from("study_reports")
        .select("*")
        .eq("slug", params.slug.trim())
        .eq("user_id", user.id)
        .maybeSingle();
      if (res.error || !res.data) throw new AppError(404, "Report not found.");
      return res.data;
    }
    if (params.studyRunId) {
      const res = await db
        .from("study_reports")
        .select("*")
        .eq("study_run_id", params.studyRunId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (res.error || !res.data) {
        throw new AppError(
          404,
          "No completed report found for this study run yet. Check get_study_status.",
        );
      }
      return res.data;
    }
    if (params.studyId) {
      const run = await db
        .from("study_runs")
        .select("id")
        .eq("study_id", params.studyId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (run.error || !run.data) {
        throw new AppError(404, "Study run not found.");
      }
      const res = await db
        .from("study_reports")
        .select("*")
        .eq("study_run_id", run.data.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (res.error || !res.data) {
        throw new AppError(
          404,
          "No completed report found for this study yet. Check get_study_status.",
        );
      }
      return res.data;
    }
    throw new AppError(400, "Provide one of slug, studyRunId, or studyId.");
  }

  async function loadChannelDetail(channelId: string) {
    const ch = await resolveChannelRecord(channelId);
    const [audRes, vidsRes, runRes] = await Promise.all([
      db
        .from("audiences")
        .select("*")
        .eq("channel_id", ch.id)
        .eq("user_id", user.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("channel_videos")
        .select(
          "id,youtube_video_id,title,view_count,outlier_ratio,thumbnail_url,published_at,transcript_source",
        )
        .eq("channel_id", ch.id)
        .eq("user_id", user.id)
        .order("outlier_ratio", { ascending: false })
        .limit(20),
      db
        .from("channel_ingestion_runs")
        .select("*")
        .eq("channel_id", ch.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const minds = audRes.data
      ? (
          await db
            .from("audience_minds")
            .select("*")
            .eq("audience_id", audRes.data.id)
            .eq("user_id", user.id)
            .order("sort_order", { ascending: true })
        ).data || []
      : [];

    return {
      channel: ch,
      audience: audRes.data || null,
      minds,
      activeMindCount: minds.filter((m: { active: boolean }) => m.active)
        .length,
      videos: vidsRes.data || [],
      latestRun: runRes.data || null,
    };
  }

  async function buildReportView(
    rep: Record<string, any>,
    filters?: {
      archetype?: (typeof mindArchetypes)[number];
      vote?: "A" | "B" | "C" | "none_keep_scrolling";
      includeFullMinds?: boolean;
    },
  ) {
    const payload = rep.payload as ReportPayload;
    const optionPaths = (payload.packagingMatrix || []).flatMap((opt) => [
      opt.jpgPath,
      opt.imagePath,
    ]);
    const signedMap = await signPaths(
      [...optionPaths, rep.pdf_path, rep.markdown_path],
      3600,
    );

    const packagingMatrix = (payload.packagingMatrix || []).map((opt) => ({
      ...opt,
      imageUrl: signedMap[opt.jpgPath || opt.imagePath || ""] || null,
      fullResUrl: signedMap[opt.imagePath || opt.jpgPath || ""] || null,
    }));

    let voiceOfMinds = payload.voiceOfMinds || [];
    if (filters?.archetype) {
      voiceOfMinds = voiceOfMinds.filter(
        (m) => m.archetype === filters.archetype,
      );
    }
    if (filters?.vote) {
      voiceOfMinds = voiceOfMinds.filter((m) => m.chosenOption === filters.vote);
    }

    const origin = appOrigin();
    const reportUrl = `${origin}/reports/${rep.slug}`;
    return {
      kind: "preflight_report" as const,
      slug: rep.slug as string,
      studyRunId: rep.study_run_id as string,
      isPublic: !!rep.is_public,
      reportUrl,
      pdfUrl: rep.pdf_path ? signedMap[rep.pdf_path] || null : null,
      markdownUrl: rep.markdown_path
        ? signedMap[rep.markdown_path] || null
        : null,
      downloadApiPdf: `${origin}/api/reports/${rep.slug}/download?format=pdf`,
      downloadApiMarkdown: `${origin}/api/reports/${rep.slug}/download?format=md`,
      deliverablesExpireIn: 3600,
      report: {
        ...payload,
        packagingMatrix,
        voiceOfMinds:
          filters?.includeFullMinds === false
            ? voiceOfMinds.map((m) => ({
                mindId: m.mindId,
                name: m.name,
                role: m.role,
                archetype: m.archetype,
                chosenOption: m.chosenOption,
                clickConfidence: m.clickConfidence,
                verbatimClickReason: m.verbatimClickReason,
                topHesitationKiller: m.topHesitationKiller,
                commentSkepticismQuote: m.commentSkepticismQuote,
                retentionCliffFlag: m.retentionCliffFlag,
              }))
            : voiceOfMinds,
      },
      matchedMindsCount: voiceOfMinds.length,
      totalMindsCount: (payload.voiceOfMinds || []).length,
    };
  }

  /* =========================================================================
   * 1. MODEL PREFERENCES (PER-LEG AI ROUTING)
   * ========================================================================= */
  tool(
    "get_model_preferences",
    "Read your saved per-leg AI model preferences (image, mediator, reviewer, scorer, minds, strategist) plus the exact model IDs each alias resolves to with your connected keys.",
    {},
    "studio:read",
    async () => {
      const keys = await userKeys(db, user.id);
      const resolved: Record<string, string | null> = {};
      await Promise.all(
        textAliases.map(async (alias) => {
          const key = keys[alias.provider];
          resolved[alias.id] = key
            ? (await resolveAlias(alias, key)).model
            : null;
        }),
      );
      return {
        models: readModelPreferences(user.user_metadata),
        resolved,
        availableTextAliases: textAliases.map((a) => ({
          id: a.id,
          label: a.label,
          provider: a.provider,
          connected: !!keys[a.provider],
        })),
        availableImageModels: [...imageGenerators],
        availableScorers: [...scorers],
      };
    },
    true,
  );

  tool(
    "set_model_preferences",
    "Update which AI models power each leg of OpenPikzels: image generator, prompt mediator, vision reviewer, virality scorer, 16 Minds simulator (Leg B), and Editorial Angle Strategist (Leg C). Omitted fields keep their current value.",
    {
      image: z.enum(imageGenerators).optional(),
      scorer: z.enum(["jev", "model"]).optional(),
      mediator: z.string().max(40).optional(),
      reviewer: z.string().max(40).optional(),
      minds: z.string().max(40).optional(),
      strategist: z.string().max(40).optional(),
    },
    "studio:write",
    async (args) => {
      const current = readModelPreferences(user.user_metadata);
      const merged = modelPreferencesSchema.parse({
        ...current,
        ...(args.image !== undefined ? { image: args.image } : {}),
        ...(args.scorer !== undefined ? { scorer: args.scorer } : {}),
        ...(args.mediator !== undefined ? { mediator: args.mediator } : {}),
        ...(args.reviewer !== undefined ? { reviewer: args.reviewer } : {}),
        ...(args.minds !== undefined ? { minds: args.minds } : {}),
        ...(args.strategist !== undefined
          ? { strategist: args.strategist }
          : {}),
      });
      const known = new Set(["auto", ...textAliases.map((a) => a.id)]);
      for (const field of ["reviewer", "mediator", "minds", "strategist"] as const) {
        if (!known.has(merged[field])) {
          throw new AppError(
            400,
            `Unknown model alias "${merged[field]}" for ${field}. Call get_model_preferences to see valid aliases.`,
          );
        }
      }
      const mediatorAlias = textAliases.find((a) => a.id === merged.mediator);
      if (mediatorAlias && mediatorAlias.provider === "anthropic") {
        throw new AppError(
          400,
          "The prompt mediator requires an OpenAI or Google model.",
        );
      }
      await saveUserModelPreferences(user, merged);
      return { models: merged, saved: true };
    },
  );

  /* =========================================================================
   * 2. YOUTUBE CHANNELS & 12-16 SYNTHETIC MINDS
   * ========================================================================= */
  tool(
    "connect_channel",
    "Link a YouTube channel (URL, @handle, or UC... channel ID) or refresh an existing channel to ingest recent videos, outlier performance, comments, and transcripts (native Gemini or Transcript API), then synthesize demographic/psychographic distributions and 16 persistent synthetic Minds in the background via Inngest.",
    {
      channel: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .describe("YouTube channel URL, @handle, or UC... channel ID."),
      refreshChannelId: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Optional existing channel UUID to rebuild/version its audience and Minds.",
        ),
    },
    "studio:ai",
    async ({ channel, refreshChannelId }) => {
      await allowed("studio:write");
      channelIdentifier(channel);
      const keys = await userKeys(db, user.id);
      if (!keys.youtube) {
        throw new AppError(
          403,
          "Connect your YouTube Data API key in OpenPikzels Keys before linking a channel.",
        );
      }
      if (!keys.google && !keys.openai && !keys.anthropic) {
        throw new AppError(
          403,
          "Connect Google Gemini (recommended — also transcribes YouTube videos natively), OpenAI, or Claude in OpenPikzels Keys.",
        );
      }
      if (refreshChannelId) {
        const owned = await db
          .from("channels")
          .select("id")
          .eq("id", refreshChannelId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (owned.error || !owned.data) {
          throw new AppError(404, "Channel to refresh not found.");
        }
      }

      const runInsert = await db
        .from("channel_ingestion_runs")
        .insert({
          user_id: user.id,
          channel_id: refreshChannelId ?? null,
          input_identifier: channel,
          status: "queued",
          progress_pct: 5,
          current_message: "Queued channel ingestion…",
        })
        .select("id")
        .single();
      if (runInsert.error || !runInsert.data) throw runInsert.error;
      const runId = runInsert.data.id as string;

      await inngest.send(
        channelIngestRequested.create({
          runId,
          userId: user.id,
          channelInput: channel,
          ...(refreshChannelId ? { existingChannelId: refreshChannelId } : {}),
        }),
      );

      return {
        runId,
        status: "queued",
        channelInput: channel,
        dashboardUrl: `${appOrigin()}/channels`,
        next: "Poll get_channel_ingestion_status with this runId until status is 'completed' (typically 1-2 minutes).",
      };
    },
  );

  tool(
    "list_channels",
    "List all linked YouTube channels, their latest persistent Audience version/language/status, active Mind counts (12-16), and recent ingestion runs.",
    {},
    "studio:read",
    async () => {
      const [chRes, audRes, runsRes] = await Promise.all([
        db
          .from("channels")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        db
          .from("audiences")
          .select(
            "id,channel_id,version,language,status,created_at,audience_minds(id,active)",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        db
          .from("channel_ingestion_runs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (chRes.error) throw chRes.error;
      if (audRes.error) throw audRes.error;

      const latestAudienceByChannel = new Map<
        string,
        (typeof audRes.data)[number]
      >();
      for (const a of audRes.data || []) {
        if (!latestAudienceByChannel.has(a.channel_id)) {
          latestAudienceByChannel.set(a.channel_id, a);
        }
      }

      const channels = (chRes.data || []).map((c) => {
        const aud = latestAudienceByChannel.get(c.id);
        const minds = Array.isArray(aud?.audience_minds)
          ? aud.audience_minds
          : [];
        return {
          ...c,
          latestAudience: aud
            ? {
                id: aud.id,
                version: aud.version,
                language: aud.language,
                status: aud.status,
                totalMinds: minds.length,
                activeMinds: minds.filter((m: { active: boolean }) => m.active)
                  .length,
              }
            : null,
        };
      });

      return { channels, recentRuns: runsRes.data || [] };
    },
    true,
  );

  tool(
    "get_channel",
    "Inspect a linked YouTube channel by UUID, @handle, or title: returns metadata, demographic/psychographic distributions, outlier patterns, comment themes, top 20 videos, and all 12-16 synthetic Minds.",
    {
      channel: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .describe("Channel UUID, @handle, or title."),
    },
    "studio:read",
    async ({ channel }) => loadChannelDetail(channel),
    true,
  );

  tool(
    "get_channel_ingestion_status",
    "Check live background progress for a channel ingestion run (stage, percent complete, status message, audit timeline, and resulting channelId once ready).",
    {
      runId: z.string().uuid(),
    },
    "studio:read",
    async ({ runId }) => {
      const [runRes, eventsRes] = await Promise.all([
        db
          .from("channel_ingestion_runs")
          .select("*")
          .eq("id", runId)
          .eq("user_id", user.id)
          .maybeSingle(),
        db
          .from("async_run_events")
          .select("id,phase,progress_pct,message,created_at")
          .eq("run_type", "channel_ingestion")
          .eq("run_id", runId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);
      if (runRes.error || !runRes.data) {
        throw new AppError(404, "Channel ingestion run not found.");
      }
      return {
        run: runRes.data,
        events: eventsRes.data || [],
        channelUrl: runRes.data.channel_id
          ? `${appOrigin()}/channels/${runRes.data.channel_id}`
          : `${appOrigin()}/channels`,
      };
    },
    true,
  );

  tool(
    "update_mind",
    "Edit or toggle one of the 12-16 synthetic audience Minds (name, role, click_bar 1-10, skepticism_triggers, thinking_patterns, or active toggle). Keep at least 12 Minds active per audience.",
    {
      mindId: z.string().uuid(),
      active: z.boolean().optional(),
      name: z.string().trim().min(2).max(80).optional(),
      role: z.string().trim().min(3).max(160).optional(),
      click_bar: z.number().int().min(1).max(10).optional(),
      skepticism_triggers: z
        .array(z.string().trim().min(3).max(220))
        .min(1)
        .max(6)
        .optional(),
      thinking_patterns: z
        .array(z.string().trim().min(3).max(220))
        .min(1)
        .max(6)
        .optional(),
    },
    "studio:write",
    async (args) => {
      const patch: Record<string, unknown> = {};
      if (args.active !== undefined) patch.active = args.active;
      if (args.name !== undefined) patch.name = args.name;
      if (args.role !== undefined) patch.role = args.role;
      if (args.click_bar !== undefined) patch.click_bar = args.click_bar;
      if (args.skepticism_triggers !== undefined)
        patch.skepticism_triggers = args.skepticism_triggers;
      if (args.thinking_patterns !== undefined)
        patch.thinking_patterns = args.thinking_patterns;
      if (!Object.keys(patch).length) {
        throw new AppError(400, "Provide at least one field to update.");
      }

      const existing = await db
        .from("audience_minds")
        .select("id,audience_id,active")
        .eq("id", args.mindId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing.error || !existing.data) {
        throw new AppError(404, "Mind not found.");
      }

      if (args.active === false && existing.data.active) {
        const activeCountRes = await db
          .from("audience_minds")
          .select("id", { count: "exact", head: true })
          .eq("audience_id", existing.data.audience_id)
          .eq("user_id", user.id)
          .eq("active", true);
        if ((activeCountRes.count ?? 0) <= 12) {
          throw new AppError(
            409,
            "At least 12 Minds must remain active for Pre-Flight Studies. Enable another Mind first.",
          );
        }
      }

      const updated = await db
        .from("audience_minds")
        .update(patch)
        .eq("id", args.mindId)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (updated.error || !updated.data) {
        throw new AppError(404, "Mind not found.");
      }
      return { mind: updated.data };
    },
  );

  tool(
    "delete_channel",
    "Permanently delete a linked YouTube channel and its audiences/Minds. Past Pre-Flight Reports remain intact.",
    {
      channel: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .describe("Channel UUID, @handle, or title."),
    },
    "studio:write",
    async ({ channel }) => {
      const ch = await resolveChannelRecord(channel);
      const del = await db
        .from("channels")
        .delete()
        .eq("id", ch.id)
        .eq("user_id", user.id);
      if (del.error) throw del.error;
      return { deleted: true, channelId: ch.id, title: ch.title };
    },
    false,
    true,
  );

  /* =========================================================================
   * 3. CREATOR PERSONAS (TONE OF VOICE & VISUAL STYLE RULES)
   * ========================================================================= */
  tool(
    "update_persona",
    "Configure a Creator Persona's voice and visual brand rules for Pre-Flight Studies: name, notes, tone_of_voice, visual_style_rules, and defaultStyle. Look up by personaId or persona name.",
    {
      personaId: z.string().uuid().optional(),
      persona: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .optional()
        .describe("Saved persona name (e.g. 'Derrick' or '@Derrick')."),
      name: z.string().trim().min(2).max(80).optional(),
      notes: z.string().max(800).optional(),
      tone_of_voice: z.string().max(1200).optional(),
      visual_style_rules: z.string().max(1200).optional(),
      defaultStyleId: z.string().uuid().nullable().optional(),
      defaultStyle: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .optional()
        .describe("Saved style name to set as this persona's default style."),
    },
    "studio:write",
    async (args) => {
      const id =
        args.personaId ||
        (args.persona
          ? await profileIdByName("persona", args.persona)
          : undefined);
      if (!id) {
        throw new AppError(400, "Provide personaId or persona name.");
      }
      const patch: Record<string, unknown> = {};
      if (args.name !== undefined) patch.name = args.name;
      if (args.notes !== undefined) patch.notes = args.notes;
      if (args.tone_of_voice !== undefined)
        patch.tone_of_voice = args.tone_of_voice;
      if (args.visual_style_rules !== undefined)
        patch.visual_style_rules = args.visual_style_rules;
      if (args.defaultStyleId !== undefined) {
        patch.default_style_id = args.defaultStyleId;
      } else if (args.defaultStyle) {
        patch.default_style_id = await profileIdByName(
          "style",
          args.defaultStyle,
        );
      }
      if (!Object.keys(patch).length) {
        throw new AppError(400, "Provide at least one field to update.");
      }

      const res = await db
        .from("studio_personas")
        .update(patch)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .single();
      if (res.error || !res.data) {
        throw new AppError(404, "Creator Persona not found.");
      }
      const refs = Array.isArray(res.data.refs) ? res.data.refs : [];
      const signedRefs = await signPaths(refs, 600);
      return {
        persona: res.data,
        referenceUrls: refs.map((p: string) => ({
          path: p,
          url: signedRefs[p] || null,
        })),
      };
    },
  );

  /* =========================================================================
   * 4. PRE-FLIGHT STUDIES & ASYNC TRIANGULATION ENGINE
   * ========================================================================= */
  tool(
    "get_default_questions",
    "Get the default 8 diagnostic questions for a Pre-Flight Study in English ('en') or Spanish ('es'). Edit or trim to 6-8 questions before launching.",
    {
      language: z.enum(["en", "es"]).default("en"),
    },
    "studio:read",
    async ({ language }) => ({
      language,
      questions: defaultDiagnosticQuestions(language),
    }),
    true,
  );

  tool(
    "estimate_study_cost",
    "Calculate upfront synthetic response count (Minds × Questions), AI thumbnail renders, and honest estimated USD range on your connected BYOK API keys before launching a Pre-Flight Study.",
    {
      mindsCount: z.number().int().min(12).max(16).default(16),
      questionsCount: z.number().int().min(6).max(8).default(8),
      hasDraftThumbnail: z.boolean().default(false),
      scriptChars: z.number().int().min(40).max(80000).default(6000),
    },
    "studio:read",
    async (args) => {
      const models = readModelPreferences(user.user_metadata);
      const estimate = estimateStudyCost({
        mindsCount: args.mindsCount,
        questionsCount: args.questionsCount,
        hasDraftThumbnail: args.hasDraftThumbnail,
        scriptChars: args.scriptChars,
        mindsModel: models.minds,
        strategistModel: models.strategist,
      });
      return { ...estimate, models };
    },
    true,
  );

  tool(
    "launch_preflight_study",
    "Launch an asynchronous 3-leg Pre-Flight Study via Inngest (Leg A: 3 Packaging Options + Klickz scoring; Leg B: 2-pass anti-flattery simulation across 12-16 Minds with mandatory Keep Scrolling; Leg C: full-script Editorial Angle Strategist; Final: shareable Web Report + PDF + Markdown + email). Pass either audienceId or channel (@handle/name/UUID). Optionally pass draftImage (chat attachment), draftThumbnailPath, draftImageUrl, or draftBase64 to test your draft thumbnail head-to-head as Option A against 2 AI challengers.",
    {
      audienceId: z
        .string()
        .uuid()
        .optional()
        .describe("Ready audience UUID. Optional if channel is provided."),
      channel: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe(
          "Linked channel UUID, @handle, or title (auto-picks its latest ready audience).",
        ),
      personaId: z.string().uuid().optional(),
      persona: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .optional()
        .describe("Creator Persona name (e.g. 'Derrick')."),
      styleId: z.string().uuid().optional(),
      style: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .optional()
        .describe("Visual Style name."),
      titleDraft: z.string().trim().min(3).max(160),
      scriptText: z
        .string()
        .trim()
        .min(40)
        .max(80000)
        .describe("Full video script or transcript."),
      thumbnailPrompt: z
        .string()
        .trim()
        .max(2400)
        .default("")
        .describe("Visual direction or concept for thumbnails."),
      productionMode: productionModeSchema.describe(
        "'pre_shoot' allows script/angle rewrites; 'footage_locked' forbids reshoots and generates cold-open pull quotes + 3 zero-reshoot packaging pivots.",
      ),
      draftImage: chatFileSchema
        .optional()
        .describe(
          "Optional creator draft thumbnail attached in this chat to test head-to-head as Option A.",
        ),
      draftThumbnailPath: z
        .string()
        .trim()
        .min(3)
        .max(500)
        .optional()
        .describe(
          "Optional owned studio-assets path (from upload_reference or a creation) for Option A.",
        ),
      draftImageUrl: z
        .string()
        .url()
        .max(1200)
        .optional()
        .describe("Optional public image URL to import as Option A draft."),
      draftBase64: z
        .string()
        .max(2800000)
        .optional()
        .describe("Optional base64 PNG/JPEG/WebP to import as Option A draft."),
      language: z.enum(["en", "es"]).optional(),
      diagnosticQuestions: z
        .array(diagnosticQuestionSchema)
        .min(6)
        .max(8)
        .optional()
        .describe(
          "Optional 6-8 diagnostic questions. Defaults to the official bilingual 8-question set.",
        ),
      activeMindIds: z
        .array(z.string().uuid())
        .min(12)
        .max(16)
        .optional()
        .describe(
          "Optional specific Mind UUIDs (12-16). Defaults to all active Minds in the audience.",
        ),
      notifyEmails: z
        .array(z.string().trim().email().max(200))
        .max(3)
        .default([])
        .describe(
          "Optional up to 3 extra team emails (editor, designer) to CC on the final PDF/Markdown report.",
        ),
    },
    "studio:ai",
    async (args) => {
      await allowed("studio:write");
      const keys = await userKeys(db, user.id);
      if (!keys.openai && !keys.google) {
        throw new AppError(
          403,
          "Connect an OpenAI or Google Gemini API key in OpenPikzels Keys to run Pre-Flight Studies.",
        );
      }

      // 1. Resolve Audience
      let audienceId = args.audienceId as string | undefined;
      if (!audienceId) {
        if (!args.channel) {
          throw new AppError(
            400,
            "Provide either audienceId or channel (@handle/name/UUID). Call list_channels to see ready audiences.",
          );
        }
        const ch = await resolveChannelRecord(args.channel);
        const latestAud = await db
          .from("audiences")
          .select("id,status")
          .eq("channel_id", ch.id)
          .eq("user_id", user.id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestAud.error || !latestAud.data) {
          throw new AppError(
            404,
            `Channel "${ch.title}" has no built audience yet. Wait for ingestion to finish or run connect_channel.`,
          );
        }
        audienceId = latestAud.data.id as string;
      }

      const audRes = await db
        .from("audiences")
        .select("id,language,status")
        .eq("id", audienceId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (audRes.error || !audRes.data) {
        throw new AppError(404, "Selected channel audience not found.");
      }
      if (audRes.data.status !== "ready") {
        throw new AppError(
          409,
          "Wait until the channel audience finishes building its Minds before launching a study.",
        );
      }

      // 2. Resolve active Minds (default to audience's active 12-16 Minds)
      let activeMindIds = args.activeMindIds as string[] | undefined;
      if (!activeMindIds?.length) {
        const mindsRes = await db
          .from("audience_minds")
          .select("id")
          .eq("audience_id", audienceId)
          .eq("user_id", user.id)
          .eq("active", true)
          .order("sort_order", { ascending: true })
          .limit(16);
        if (mindsRes.error) throw mindsRes.error;
        activeMindIds = (mindsRes.data || []).map((m) => m.id as string);
        if (activeMindIds.length < 12) {
          throw new AppError(
            409,
            `Audience only has ${activeMindIds.length} active Minds (minimum 12 required). Use update_mind to activate at least 12 Minds.`,
          );
        }
      }

      // 3. Resolve Persona & Style
      const personaId =
        (args.personaId as string | undefined) ||
        (args.persona
          ? await profileIdByName("persona", args.persona)
          : null);
      const styleId =
        (args.styleId as string | undefined) ||
        (args.style ? await profileIdByName("style", args.style) : null);

      // 4. Resolve optional head-to-head Option A draft thumbnail
      let draftThumbnailPath: string | null = null;
      if (args.draftImage) {
        draftThumbnailPath = await saveOwnedReference(
          db,
          user.id,
          await fetchChatFile(args.draftImage),
        );
      } else if (args.draftBase64) {
        draftThumbnailPath = await saveOwnedReference(
          db,
          user.id,
          await decodeInlineImage(args.draftBase64),
        );
      } else if (args.draftImageUrl) {
        draftThumbnailPath = await saveOwnedReference(
          db,
          user.id,
          await fetchReference(args.draftImageUrl),
        );
      } else if (args.draftThumbnailPath) {
        if (!ownedPath(args.draftThumbnailPath, user.id)) {
          throw new AppError(
            403,
            "draftThumbnailPath must be an owned studio-assets path.",
          );
        }
        draftThumbnailPath = args.draftThumbnailPath;
      }

      const language =
        args.language ||
        (audRes.data.language?.toLowerCase().startsWith("es") ? "es" : "en");
      const diagnosticQuestions =
        args.diagnosticQuestions && args.diagnosticQuestions.length >= 6
          ? args.diagnosticQuestions
          : defaultDiagnosticQuestions(language);
      const opening60sText = extractOpening60s(args.scriptText);
      const models = readModelPreferences(user.user_metadata);
      const cost = estimateStudyCost({
        mindsCount: activeMindIds.length,
        questionsCount: diagnosticQuestions.length,
        hasDraftThumbnail: !!draftThumbnailPath,
        scriptChars: args.scriptText.length,
        mindsModel: models.minds,
        strategistModel: models.strategist,
      });

      const studyRes = await db
        .from("studies")
        .insert({
          user_id: user.id,
          audience_id: audienceId,
          persona_id: personaId,
          style_id: styleId,
          language,
          title_draft: args.titleDraft,
          script_text: args.scriptText,
          opening_60s_text: opening60sText,
          thumbnail_prompt: args.thumbnailPrompt || "",
          draft_thumbnail_path: draftThumbnailPath,
          production_mode: args.productionMode,
          diagnostic_questions: diagnosticQuestions,
          active_mind_ids: activeMindIds,
          notify_emails: args.notifyEmails || [],
        })
        .select("id")
        .single();
      if (studyRes.error || !studyRes.data) throw studyRes.error;
      const studyId = studyRes.data.id as string;

      const runRes = await db
        .from("study_runs")
        .insert({
          study_id: studyId,
          user_id: user.id,
          status: "queued",
          progress_pct: 2,
          current_message: "Queued Pre-Flight Study…",
          estimated_usd_min: cost.estimatedUsdMin,
          estimated_usd_max: cost.estimatedUsdMax,
        })
        .select("id")
        .single();
      if (runRes.error || !runRes.data) throw runRes.error;
      const runId = runRes.data.id as string;

      await inngest.send(
        studyTriangulateRequested.create({
          studyId,
          runId,
          userId: user.id,
        }),
      );

      return {
        studyId,
        runId,
        status: "queued",
        productionMode: args.productionMode,
        headToHeadDraftMode: !!draftThumbnailPath,
        language,
        mindsCount: activeMindIds.length,
        questionsCount: diagnosticQuestions.length,
        cost,
        trackerUrl: `${appOrigin()}/studies/${runId}`,
        next: "Fire-and-forget pipeline started (typically 2-5 minutes). Poll get_study_status with runId to see live phases and early Leg A thumbnails, or wait for email delivery.",
      };
    },
    false,
    false,
    { fileParams: ["draftImage"] },
  );

  tool(
    "list_studies",
    "List your Pre-Flight Studies with linked channel, production mode (pre_shoot / footage_locked), live progress status, and final Executive Verdict once completed.",
    {
      limit: z.number().int().min(1).max(50).default(20),
    },
    "studio:read",
    async ({ limit }) => {
      const [studiesRes, runsRes, reportsRes] = await Promise.all([
        db
          .from("studies")
          .select(
            "id,title_draft,production_mode,language,created_at,audience_id,audiences(channels(title,handle))",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit),
        db
          .from("study_runs")
          .select(
            "id,study_id,status,progress_pct,current_message,error_message,email_sent_at,created_at,completed_at",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit * 2),
        db
          .from("study_reports")
          .select("study_run_id,slug,is_public,payload")
          .eq("user_id", user.id),
      ]);
      if (studiesRes.error) throw studiesRes.error;

      const latestRunByStudy = new Map<string, any>();
      for (const r of runsRes.data || []) {
        if (!latestRunByStudy.has(r.study_id))
          latestRunByStudy.set(r.study_id, r);
      }
      const reportByRun = new Map(
        (reportsRes.data || []).map((r) => [r.study_run_id, r]),
      );
      const origin = appOrigin();

      const studies = (studiesRes.data || []).map((s: any) => {
        const run = latestRunByStudy.get(s.id) || null;
        const rep = run ? reportByRun.get(run.id) || null : null;
        const aud = Array.isArray(s.audiences) ? s.audiences[0] : s.audiences;
        const ch = aud
          ? Array.isArray(aud.channels)
            ? aud.channels[0]
            : aud.channels
          : null;
        return {
          id: s.id,
          titleDraft: s.title_draft,
          productionMode: s.production_mode,
          language: s.language,
          createdAt: s.created_at,
          channelTitle: ch?.title || "Channel",
          channelHandle: ch?.handle || null,
          latestRun: run,
          trackerUrl: run ? `${origin}/studies/${run.id}` : null,
          report: rep
            ? {
                slug: rep.slug,
                isPublic: rep.is_public,
                reportUrl: `${origin}/reports/${rep.slug}`,
                verdictCode: rep.payload?.verdict?.code ?? null,
                winningOptionKey:
                  rep.payload?.verdict?.winningOptionKey ?? null,
              }
            : null,
        };
      });

      return { studies };
    },
    true,
  );

  tool(
    "get_study_status",
    "Check live progress of a Pre-Flight Study run (by runId or studyId): returns phase, progress %, pipeline audit timeline, partial Leg A thumbnails with signed URLs as they finish, and the final report slug/URLs once completed.",
    {
      id: z.string().uuid().describe("Study runId or studyId."),
    },
    "studio:read",
    async ({ id }) => {
      let runRes = await db
        .from("study_runs")
        .select("*, studies(id,title_draft,production_mode,language)")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!runRes.data) {
        runRes = await db
          .from("study_runs")
          .select("*, studies(id,title_draft,production_mode,language)")
          .eq("study_id", id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      }
      if (runRes.error || !runRes.data) {
        throw new AppError(404, "Study run not found.");
      }
      const run = runRes.data as any;
      const [optsRes, repRes, eventsRes] = await Promise.all([
        db
          .from("packaging_options")
          .select(
            "option_key,is_user_draft,angle_label,title,image_path,jpg_path,klickz_score",
          )
          .eq("study_run_id", run.id)
          .order("option_key", { ascending: true }),
        db
          .from("study_reports")
          .select("slug,is_public,payload")
          .eq("study_run_id", run.id)
          .maybeSingle(),
        db
          .from("async_run_events")
          .select("id,phase,progress_pct,message,created_at")
          .eq("run_type", "study_triangulation")
          .eq("run_id", run.id)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
      ]);

      const signedMap = await signPaths(
        (optsRes.data || []).map((o) => o.jpg_path || o.image_path),
        3600,
      );
      const options = (optsRes.data || []).map((o) => ({
        optionKey: o.option_key,
        isUserDraft: o.is_user_draft,
        angleLabel: o.angle_label,
        title: o.title,
        overallScore: o.klickz_score?.overall ?? null,
        imageUrl: signedMap[o.jpg_path || o.image_path || ""] || null,
      }));
      const origin = appOrigin();
      const study = Array.isArray(run.studies) ? run.studies[0] : run.studies;

      return {
        kind: "study_status" as const,
        runId: run.id,
        studyId: run.study_id,
        titleDraft: study?.title_draft ?? "",
        productionMode: study?.production_mode ?? "pre_shoot",
        language: study?.language ?? "en",
        status: run.status,
        progressPct: run.progress_pct,
        currentMessage: run.current_message,
        errorMessage: run.error_message,
        emailSentAt: run.email_sent_at,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        trackerUrl: `${origin}/studies/${run.id}`,
        options,
        events: eventsRes.data || [],
        report: repRes.data
          ? {
              slug: repRes.data.slug,
              isPublic: repRes.data.is_public,
              reportUrl: `${origin}/reports/${repRes.data.slug}`,
              verdictCode: repRes.data.payload?.verdict?.code ?? null,
              headline: repRes.data.payload?.verdict?.headline ?? null,
              winningOptionKey:
                repRes.data.payload?.verdict?.winningOptionKey ?? null,
            }
          : null,
      };
    },
    true,
    false,
    {
      ui: true,
      uiInvoking: "Checking Pre-Flight Study progress…",
      uiInvoked: "Pre-Flight Study status updated",
      toText: (r) => {
        const rep = r.report as Record<string, any> | null;
        if (rep?.slug) {
          return `Pre-Flight Study "${r.titleDraft}" completed (${rep.verdictCode}). Winning Option: ${rep.winningOptionKey ?? "None"}. Report: ${rep.reportUrl}. Call get_preflight_report with slug "${rep.slug}" to inspect full details.`;
        }
        return `Pre-Flight Study "${r.titleDraft}" is ${r.status} (${r.progressPct}%): ${r.currentMessage}${r.errorMessage ? ` · Error: ${r.errorMessage}` : ""}`;
      },
    },
  );

  /* =========================================================================
   * 5. EXECUTIVE REPORTS, TEAM HANDOFF & QUICK STUDIO BRIDGE
   * ========================================================================= */
  tool(
    "get_preflight_report",
    "Read a completed Executive Pre-Flight Report (by slug, studyRunId, or studyId) with Executive Verdict, simulated Click Share (including Keep Scrolling), Retention Cliff warning, Angle/Script Diagnosis (pre_shoot rewrite OR footage_locked cold-open pull quote + 3 pivots), Side-by-Side Packaging Matrix with signed thumbnails + designer redlines, and Voice of the Minds (filterable by archetype and vote). Renders an interactive Executive Report card in MCP Apps hosts.",
    {
      slug: z.string().trim().min(8).max(32).optional(),
      studyRunId: z.string().uuid().optional(),
      studyId: z.string().uuid().optional(),
      archetype: z
        .enum(mindArchetypes)
        .optional()
        .describe("Optional filter for Voice of the Minds."),
      vote: z
        .enum(["A", "B", "C", "none_keep_scrolling"])
        .optional()
        .describe("Optional vote filter for Voice of the Minds."),
      includeFullMinds: z
        .boolean()
        .default(true)
        .describe(
          "Include per-question answers for every Mind (set false for a lighter payload).",
        ),
    },
    "studio:read",
    async (args) => {
      const rep = await resolveReportRow(args);
      return buildReportView(rep, {
        archetype: args.archetype,
        vote: args.vote,
        includeFullMinds: args.includeFullMinds,
      });
    },
    true,
    false,
    {
      ui: true,
      uiInvoking: "Loading Executive Pre-Flight Report…",
      uiInvoked: "Executive Pre-Flight Report ready",
      toText: (r) => {
        const rep = r.report as ReportPayload;
        const v = rep.verdict;
        return `[${v.code}] ${rep.studyTitleDraft} (${rep.productionMode})\n${v.headline}\nClick Share: A ${v.clickShare.A.pct}% · B ${v.clickShare.B.pct}% · C ${v.clickShare.C.pct}% · Keep Scrolling ${v.clickShare.none_keep_scrolling.pct}%\nRetention Cliff (${v.retentionCliff.severity.toUpperCase()}): ${v.retentionCliff.summary}\nReport URL: ${r.reportUrl}`;
      },
    },
  );

  tool(
    "get_report_markdown",
    "Return the complete, clean bilingual Markdown (.md) Executive Pre-Flight Report ready to paste into Notion, Google Docs, Slack, or an editor brief.",
    {
      slug: z.string().trim().min(8).max(32).optional(),
      studyRunId: z.string().uuid().optional(),
      studyId: z.string().uuid().optional(),
    },
    "studio:read",
    async (args) => {
      const rep = await resolveReportRow(args);
      const reportUrl = `${appOrigin()}/reports/${rep.slug}`;
      let markdown = "";
      if (rep.markdown_path) {
        const dl = await db.storage
          .from("studio-assets")
          .download(rep.markdown_path);
        if (!dl.error && dl.data) {
          markdown = await dl.data.text();
        }
      }
      if (!markdown) {
        markdown = renderReportMarkdown(rep.payload as ReportPayload, reportUrl);
      }
      return {
        slug: rep.slug,
        reportUrl,
        markdown,
      };
    },
    true,
    false,
    {
      toText: (r) => String(r.markdown || ""),
    },
  );

  tool(
    "get_report_deliverables",
    "Get fresh 1-hour signed download URLs for a Pre-Flight Report's server-generated PDF, Markdown (.md), all 3 high-resolution packaging thumbnails, and the shareable /reports/:slug URL.",
    {
      slug: z.string().trim().min(8).max(32).optional(),
      studyRunId: z.string().uuid().optional(),
      studyId: z.string().uuid().optional(),
    },
    "studio:read",
    async (args) => {
      const rep = await resolveReportRow(args);
      const payload = rep.payload as ReportPayload;
      const paths = [
        rep.pdf_path,
        rep.markdown_path,
        ...(payload.packagingMatrix || []).flatMap((o) => [
          o.imagePath,
          o.jpgPath,
        ]),
      ];
      const signedMap = await signPaths(paths, 3600);
      const origin = appOrigin();
      return {
        slug: rep.slug,
        isPublic: !!rep.is_public,
        reportUrl: `${origin}/reports/${rep.slug}`,
        pdfSignedUrl: rep.pdf_path ? signedMap[rep.pdf_path] || null : null,
        markdownSignedUrl: rep.markdown_path
          ? signedMap[rep.markdown_path] || null
          : null,
        downloadEndpointPdf: `${origin}/api/reports/${rep.slug}/download?format=pdf`,
        downloadEndpointMarkdown: `${origin}/api/reports/${rep.slug}/download?format=md`,
        thumbnails: (payload.packagingMatrix || []).map((o) => ({
          optionKey: o.optionKey,
          title: o.title,
          isUserDraft: o.isUserDraft,
          pngUrl: o.imagePath ? signedMap[o.imagePath] || null : null,
          jpgUrl: o.jpgPath ? signedMap[o.jpgPath] || null : null,
        })),
        expiresInSeconds: 3600,
      };
    },
    true,
  );

  tool(
    "set_report_visibility",
    "Toggle whether a Pre-Flight Report link (/reports/:slug) is publicly accessible via unlisted URL for editors and designers (isPublic=true) or private owner-only (isPublic=false).",
    {
      slug: z.string().trim().min(8).max(32),
      isPublic: z.boolean(),
    },
    "studio:write",
    async ({ slug, isPublic }) => {
      const up = await db
        .from("study_reports")
        .update({ is_public: isPublic })
        .eq("slug", slug)
        .eq("user_id", user.id)
        .select("slug,is_public")
        .single();
      if (up.error || !up.data) {
        throw new AppError(404, "Report not found.");
      }
      return {
        slug: up.data.slug,
        isPublic: up.data.is_public,
        reportUrl: `${appOrigin()}/reports/${up.data.slug}`,
      };
    },
  );

  tool(
    "email_preflight_report",
    "Email a completed Executive Pre-Flight Report (with PDF and Markdown attachments + interactive web link) via Resend to your account email and/or up to 5 team emails (editors, designers, producers).",
    {
      slug: z.string().trim().min(8).max(32).optional(),
      studyRunId: z.string().uuid().optional(),
      studyId: z.string().uuid().optional(),
      recipients: z
        .array(z.string().trim().email().max(200))
        .max(5)
        .default([])
        .describe("Additional recipient email addresses."),
      includeAccountEmail: z
        .boolean()
        .default(true)
        .describe("Also send to the signed-in owner's email address."),
    },
    "studio:write",
    async (args) => {
      const rep = await resolveReportRow(args);
      const to = [
        ...(args.includeAccountEmail && user.email ? [user.email] : []),
        ...(args.recipients || []),
      ];
      if (!to.length) {
        throw new AppError(
          400,
          "Provide at least one recipient email address.",
        );
      }
      const payload = rep.payload as ReportPayload;
      const reportUrl = `${appOrigin()}/reports/${rep.slug}`;

      let pdfBuffer: Buffer | null = null;
      if (rep.pdf_path) {
        const dl = await db.storage
          .from("studio-assets")
          .download(rep.pdf_path);
        if (!dl.error && dl.data) {
          pdfBuffer = Buffer.from(await dl.data.arrayBuffer());
        }
      }
      if (!pdfBuffer) {
        const { renderReportPdfBuffer } = await import("./reports/render-pdf");
        const optionPaths = (payload.packagingMatrix || []).map(
          (o) => o.jpgPath || o.imagePath,
        );
        const signedThumbs = await signPaths(optionPaths, 600);
        const imageDataUris: Partial<Record<"A" | "B" | "C", string>> = {};
        for (const opt of payload.packagingMatrix || []) {
          const p = opt.jpgPath || opt.imagePath;
          if (!p) continue;
          const imgDl = await db.storage.from("studio-assets").download(p);
          if (!imgDl.error && imgDl.data) {
            const buf = Buffer.from(await imgDl.data.arrayBuffer());
            const mime = p.endsWith(".jpg") ? "image/jpeg" : "image/png";
            imageDataUris[opt.optionKey] = `data:${mime};base64,${buf.toString("base64")}`;
          } else if (signedThumbs[p]) {
            imageDataUris[opt.optionKey] = signedThumbs[p];
          }
        }
        pdfBuffer = await renderReportPdfBuffer(
          payload,
          imageDataUris,
          reportUrl,
        );
      }

      let markdownContent = "";
      if (rep.markdown_path) {
        const dl = await db.storage
          .from("studio-assets")
          .download(rep.markdown_path);
        if (!dl.error && dl.data) {
          markdownContent = await dl.data.text();
        }
      }
      if (!markdownContent) {
        markdownContent = renderReportMarkdown(payload, reportUrl);
      }

      const sent = await sendPreFlightReportEmail({
        to,
        slug: rep.slug,
        reportUrl,
        report: payload,
        pdfBuffer,
        markdownContent,
      });
      if (sent.skipped) {
        throw new AppError(503, `Email delivery unavailable: ${sent.skipped}`);
      }
      await db
        .from("study_runs")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", rep.study_run_id)
        .eq("user_id", user.id);

      return {
        sent: true,
        emailId: sent.id,
        recipients: [...new Set(to.map((e) => e.trim().toLowerCase()))],
        slug: rep.slug,
        reportUrl,
      };
    },
  );

  tool(
    "promote_option_to_studio",
    "Promote any Packaging Option (A, B, or C) from a Pre-Flight Report into Quick Studio as a saved creation, preserving its thumbnail, title, visual rationale, and Klickz score. Returns a creationId ready for create_fix_plan, one_click_fix, get_fix_prompt, or recompose_thumbnail (e.g. 9:16 Shorts).",
    {
      slug: z.string().trim().min(8).max(32).optional(),
      studyRunId: z.string().uuid().optional(),
      studyId: z.string().uuid().optional(),
      optionKey: z
        .enum(["A", "B", "C"])
        .optional()
        .describe("Option to promote. Defaults to the report's winning option."),
    },
    "studio:write",
    async (args) => {
      const rep = await resolveReportRow(args);
      const payload = rep.payload as ReportPayload;
      const targetKey =
        args.optionKey || payload.verdict.winningOptionKey || "A";
      const opt: ReportOptionSnapshot | undefined = (
        payload.packagingMatrix || []
      ).find((o) => o.optionKey === targetKey);
      if (!opt) {
        throw new AppError(404, `Option ${targetKey} not found in this report.`);
      }
      const imagePath = opt.imagePath || opt.jpgPath;
      if (!imagePath) {
        throw new AppError(
          409,
          `Option ${targetKey} does not have a saved image asset to promote.`,
        );
      }

      const rawPrompt = `${opt.angleLabel}: ${opt.visualRationale}`.trim();
      const safePrompt = (
        rawPrompt.length >= 8
          ? rawPrompt
          : `Pre-Flight Option ${opt.optionKey}: ${opt.title}`
      ).slice(0, 2400);
      const safeTitle = (
        opt.title.trim() || `Pre-Flight Option ${opt.optionKey}`
      ).slice(0, 100);

      const inserted = await db
        .from("studio_creations")
        .insert({
          user_id: user.id,
          title: safeTitle,
          prompt: safePrompt,
          mode: "generate",
          style: "preflight",
          image_path: imagePath,
          status: "ready",
          score: opt.klickzScore ?? null,
          settings: defaultSettings,
          lineage: {
            origin: opt.isUserDraft ? "uploaded" : "generated",
            nativeOutput: true,
            preflightReportSlug: rep.slug,
            preflightOptionKey: opt.optionKey,
          },
        })
        .select("*")
        .single();
      if (inserted.error || !inserted.data) {
        throw new AppError(
          500,
          "Could not promote this packaging option to Quick Studio.",
        );
      }
      return {
        creationId: inserted.data.id,
        creation: inserted.data,
        optionKey: opt.optionKey,
        reportSlug: rep.slug,
        previewUrl: await signed(imagePath, 600),
        studioUrl: `${appOrigin()}/studio`,
        next: "You can now call get_fix_prompt, create_fix_plan + one_click_fix, or recompose_thumbnail (e.g. format='short' for 9:16) using this creationId.",
      };
    },
  );

  /* =========================================================================
   * 6. MCP RESOURCES & DYNAMIC RESOURCE TEMPLATES
   * ========================================================================= */
  server.registerResource(
    "workspace-overview",
    "openpikzels://workspace/overview",
    {
      description:
        "Live JSON snapshot of connected providers, per-leg AI models, linked channels, Creator Personas, and Pre-Flight Studies.",
      mimeType: "application/json",
    },
    async () => {
      await allowed("studio:read");
      const [keys, summary] = await Promise.all([
        userKeys(db, user.id),
        getPreflightWorkspaceSummary(db, user),
      ]);
      return {
        contents: [
          {
            uri: "openpikzels://workspace/overview",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                providers: Object.keys(keys).filter(
                  (k) => !!keys[k as keyof typeof keys],
                ),
                ...summary,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "channels-index",
    "openpikzels://channels",
    {
      description:
        "Live JSON index of all linked YouTube channels and their persistent Audience / 16 Minds readiness.",
      mimeType: "application/json",
    },
    async () => {
      await allowed("studio:read");
      const [chRes, audRes] = await Promise.all([
        db
          .from("channels")
          .select(
            "id,youtube_channel_id,handle,title,primary_language,subscriber_count,video_count,updated_at",
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        db
          .from("audiences")
          .select("id,channel_id,version,language,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      return {
        contents: [
          {
            uri: "openpikzels://channels",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                channels: chRes.data || [],
                audiences: audRes.data || [],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "studies-index",
    "openpikzels://studies",
    {
      description:
        "Live JSON index of recent Pre-Flight Studies, run statuses, and completed report slugs.",
      mimeType: "application/json",
    },
    async () => {
      await allowed("studio:read");
      const [studiesRes, reportsRes] = await Promise.all([
        db
          .from("studies")
          .select("id,title_draft,production_mode,language,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25),
        db
          .from("study_reports")
          .select("slug,study_run_id,is_public,production_mode,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);
      return {
        contents: [
          {
            uri: "openpikzels://studies",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                studies: studiesRes.data || [],
                reports: reportsRes.data || [],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "channel-detail",
    new ResourceTemplate("openpikzels://channels/{channelId}", {
      list: undefined,
    }),
    {
      description:
        "Full YouTube channel profile, demographic/psychographic distributions, outlier videos, and all 12-16 synthetic Minds.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      await allowed("studio:read");
      const raw = Array.isArray(variables.channelId)
        ? variables.channelId[0]
        : String(variables.channelId || "");
      const detail = await loadChannelDetail(raw);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(detail, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "report-json",
    new ResourceTemplate("openpikzels://reports/{slug}", {
      list: undefined,
    }),
    {
      description:
        "Structured Executive Pre-Flight Report JSON (verdict, click share, angle diagnosis, packaging matrix, and Voice of the Minds).",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      await allowed("studio:read");
      const slug = Array.isArray(variables.slug)
        ? variables.slug[0]
        : String(variables.slug || "");
      const rep = await resolveReportRow({ slug });
      const view = await buildReportView(rep, { includeFullMinds: true });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(view, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "report-markdown",
    new ResourceTemplate("openpikzels://reports/{slug}/markdown", {
      list: undefined,
    }),
    {
      description:
        "Clean bilingual Markdown Executive Pre-Flight Brief for Notion, Google Docs, or team handoff.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      await allowed("studio:read");
      const slug = Array.isArray(variables.slug)
        ? variables.slug[0]
        : String(variables.slug || "");
      const rep = await resolveReportRow({ slug });
      const reportUrl = `${appOrigin()}/reports/${rep.slug}`;
      let markdown = "";
      if (rep.markdown_path) {
        const dl = await db.storage
          .from("studio-assets")
          .download(rep.markdown_path);
        if (!dl.error && dl.data) markdown = await dl.data.text();
      }
      if (!markdown) {
        markdown = renderReportMarkdown(rep.payload as ReportPayload, reportUrl);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: markdown,
          },
        ],
      };
    },
  );

  /* =========================================================================
   * 7. MCP WORKFLOW PROMPTS (END-TO-END PLAYBOOKS)
   * ========================================================================= */
  server.registerPrompt(
    "onboard_channel",
    {
      title: "Onboard YouTube Channel & 16 Synthetic Minds",
      description:
        "Link a YouTube channel, track live ingestion until ready, summarize audience distributions & outliers, and calibrate the 12-16 Minds.",
      argsSchema: {
        channel: z
          .string()
          .describe("YouTube channel URL, @handle, or UC... channel ID."),
      },
    },
    async ({ channel }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Onboard the YouTube channel "${channel}" in OpenPikzels end to end:\n1. Call get_workspace first to confirm YouTube Data API + Google Gemini (or OpenAI/Claude) keys are connected.\n2. Call connect_channel with channel="${channel}".\n3. Poll get_channel_ingestion_status with the returned runId until status is "completed" (narrate each stage briefly as it progresses).\n4. Call get_channel with the channel ID and present a crisp plain-English summary of:\n   - Audience demographics, core motivations, and recurring skepticism patterns\n   - Top outlier patterns (what wins vs what flops)\n   - The 16 generated Minds grouped by archetype (loyalist, casual_scroller, skeptic, new_viewer)\n5. Ask if I want to tune any Mind's click_bar or skepticism_triggers using update_mind before running our first Pre-Flight Study.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "run_preflight_study",
    {
      title: "Run End-to-End Pre-Flight Study",
      description:
        "Guide intake (channel, persona, script, title, mode pre_shoot vs footage_locked), confirm BYOK cost estimate, launch the 3-leg triangulation pipeline, and deliver the Executive Report.",
      argsSchema: {
        channel: z
          .string()
          .optional()
          .describe("Optional channel @handle or name."),
        productionMode: z
          .enum(["pre_shoot", "footage_locked"])
          .optional()
          .describe(
            "pre_shoot (script rewrites allowed) or footage_locked (zero reshoots).",
          ),
      },
    },
    async ({ channel, productionMode }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Run a full OpenPikzels Pre-Flight Study end to end.${channel ? ` Target channel: ${channel}.` : ""}${productionMode ? ` Production mode: ${productionMode}.` : ""}\nFollow this exact sequence:\n1. Call get_workspace and list_channels to see ready audiences and Creator Personas.\n2. Confirm missing inputs with me concisely: channel audience, Creator Persona (optional), full script/transcript, draft title, thumbnail direction (or attached draft thumbnail for Option A), mandatory productionMode (pre_shoot vs footage_locked), and any editor/designer CC emails.\n3. Call get_default_questions (matching the channel language) and estimate_study_cost, then show me the upfront synthetic response count and USD range for quick confirmation.\n4. Call launch_preflight_study.\n5. Poll get_study_status until completed, then call get_preflight_report and present:\n   - Executive Verdict (SHIP / ITERATE / RETHINK) + Click Share vs Keep Scrolling\n   - Retention Cliff warning\n   - Angle & Script Diagnosis (pre_shoot rewrite OR footage_locked cold-open pull quote + 3 pivots)\n   - Side-by-side Packaging Matrix & Designer Redlines\n   - Top Hesitation Killers from the Minds\n6. Offer next actions: email_preflight_report to the team, get_report_markdown for Notion, or promote_option_to_studio to run one_click_fix / 9:16 recomposition.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "footage_locked_rescue",
    {
      title: "Footage-Locked Zero-Reshoot Packaging Rescue",
      description:
        "Audit an already-filmed or edited script strictly under footage_locked constraints: extract a cold-open pull quote for the editor and 3 zero-reshoot packaging routes.",
      argsSchema: {
        channel: z
          .string()
          .optional()
          .describe("Linked YouTube channel @handle or name."),
        editorEmail: z
          .string()
          .optional()
          .describe("Optional editor email to CC on the final PDF brief."),
      },
    },
    async ({ channel, editorEmail }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `The footage is ALREADY LOCKED — zero reshoots are allowed. Run an OpenPikzels footage_locked rescue study${channel ? ` for channel ${channel}` : ""}.\n1. Verify the ready audience via list_channels and ask me for the transcript/script, current draft title, and optional draft thumbnail.\n2. Run estimate_study_cost, then launch_preflight_study with productionMode="footage_locked"${editorEmail ? ` and notifyEmails=["${editorEmail}"]` : ""}.\n3. Once complete, call get_preflight_report and focus our handoff on:\n   - The exact verbatim Cold-Open Pull Quote and editor cut instruction\n   - The 3 Zero-Reshoot Packaging Pivots\n   - The winning thumbnail's Designer Redline notes\n4. Offer to send the PDF + Markdown brief directly to the editor/designer via email_preflight_report.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "head_to_head_thumbnail_battle",
    {
      title: "Head-to-Head Draft Thumbnail Battle (Option A vs 2 AI Challengers)",
      description:
        "Pit your existing draft thumbnail as Option A blind against 2 AI-generated challenger concepts across 16 synthetic Minds, then promote the winner to Quick Studio.",
      argsSchema: {
        channel: z
          .string()
          .optional()
          .describe("Linked YouTube channel @handle or name."),
      },
    },
    async ({ channel }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Run a blind Head-to-Head Draft Thumbnail Battle in OpenPikzels${channel ? ` for ${channel}` : ""}.\n1. Ask me to attach my draft thumbnail (or provide its URL/creationId), plus the video script, draft title, and whether footage is pre_shoot or footage_locked.\n2. Pass my draft thumbnail into launch_preflight_study (draftImage / draftThumbnailPath / draftImageUrl) so it enters as Option A against 2 AI challenger concepts (Options B & C) in blind randomized order across the 16 Minds.\n3. Once complete, call get_preflight_report and tell me honestly whether my draft beat the challengers or lost to Keep Scrolling.\n4. If a clear winner emerges, offer to call promote_option_to_studio on the winning Option so we can polish it with one_click_fix or recompose a 9:16 Shorts version.`,
          },
        },
      ],
    }),
  );
}
