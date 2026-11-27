import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { userKeys } from "@/lib/provider-context";
import { readModelPreferences } from "@/lib/model-preferences";
import { createStudySchema, extractOpening60s } from "@/lib/schemas/study";
import { estimateStudyCost } from "@/lib/study-cost";
import { inngest, studyTriangulateRequested } from "@/inngest/client";
import { AppError } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated(request);
    const [studiesRes, runsRes, reportsRes] = await Promise.all([
      db
        .from("studies")
        .select(
          "id,title_draft,production_mode,language,created_at,audience_id,audiences(channels(title,handle))",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("study_runs")
        .select(
          "id,study_id,status,progress_pct,current_message,error_message,email_sent_at,created_at,completed_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40),
      db
        .from("study_reports")
        .select("study_run_id,slug,is_public,payload")
        .eq("user_id", user.id),
    ]);
    if (studiesRes.error) throw studiesRes.error;

    const runRows = runsRes.data || [];
    const latestRunByStudy = new Map<string, (typeof runRows)[number]>();
    for (const r of runRows) {
      if (!latestRunByStudy.has(r.study_id)) latestRunByStudy.set(r.study_id, r);
    }
    const reportByRun = new Map(
      (reportsRes.data || []).map((r) => [r.study_run_id, r]),
    );

    const items = (studiesRes.data || []).map((s) => {
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
        report: rep
          ? {
              slug: rep.slug,
              isPublic: rep.is_public,
              verdictCode: rep.payload?.verdict?.code ?? null,
              winningOptionKey: rep.payload?.verdict?.winningOptionKey ?? null,
            }
          : null,
      };
    });

    return NextResponse.json(
      { studies: items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db, user } = await authenticated(request);
    const input = createStudySchema.parse(await request.json());

    const keys = await userKeys(db, user.id);
    if (!keys.openai && !keys.google) {
      throw new AppError(
        403,
        "Connect an OpenAI or Google Gemini API key in Keys to generate thumbnails and run Pre-Flight Studies.",
      );
    }

    const audRes = await db
      .from("audiences")
      .select("id,language,status")
      .eq("id", input.audienceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (audRes.error || !audRes.data) {
      throw new AppError(404, "Selected channel audience not found.");
    }
    if (audRes.data.status !== "ready") {
      throw new AppError(409, "Wait until the channel audience finishes building its Minds.");
    }

    const language = input.language || audRes.data.language || "en";
    const opening60sText = extractOpening60s(input.scriptText);
    const models = readModelPreferences(user.user_metadata);
    const cost = estimateStudyCost({
      mindsCount: input.activeMindIds.length,
      questionsCount: input.diagnosticQuestions.length,
      hasDraftThumbnail: !!input.draftThumbnailPath,
      scriptChars: input.scriptText.length,
      mindsModel: models.minds,
      strategistModel: models.strategist,
    });

    const studyRes = await db
      .from("studies")
      .insert({
        user_id: user.id,
        audience_id: input.audienceId,
        persona_id: input.personaId ?? null,
        style_id: input.styleId ?? null,
        language,
        title_draft: input.titleDraft,
        script_text: input.scriptText,
        opening_60s_text: opening60sText,
        thumbnail_prompt: input.thumbnailPrompt,
        draft_thumbnail_path: input.draftThumbnailPath ?? null,
        production_mode: input.productionMode,
        diagnostic_questions: input.diagnosticQuestions,
        active_mind_ids: input.activeMindIds,
        notify_emails: input.notifyEmails,
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

    return NextResponse.json(
      { studyId, runId, status: "queued", cost },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
