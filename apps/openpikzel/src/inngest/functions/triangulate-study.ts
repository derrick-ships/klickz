import sharp from "sharp";
import { inngest, studyTriangulateRequested } from "../client";
import { adminDb } from "@/lib/admin-db";
import { ownedAsset } from "@/lib/assets";
import { appOrigin } from "@/lib/crypto";
import { runWithWorkerUser } from "@/lib/worker-keys";
import { emitRunProgress } from "@/lib/run-progress-server";
import type { PersistedMind } from "@/lib/schemas/audience";
import type {
  DiagnosticQuestion,
  ProductionMode,
  ReportMindVoice,
  ReportOptionSnapshot,
} from "@/lib/schemas/study";
import {
  conceptPackagingRoutes,
  processUserDraftOptionA,
  renderAndScoreOption,
  type LegAInput,
} from "@/lib/triangulation/leg-a-packaging";
import {
  runMindsPass1Batch,
  runMindsPass2StressTest,
  type PackagedOptionBrief,
} from "@/lib/triangulation/leg-b-minds";
import { runEditorialStrategist } from "@/lib/triangulation/leg-c-strategist";
import {
  compileReportPayload,
  generateReportSlug,
} from "@/lib/triangulation/compile-report";
import { renderReportMarkdown } from "@/lib/reports/render-markdown";
import { renderReportPdfBuffer } from "@/lib/reports/render-pdf";
import { sendPreFlightReportEmail } from "@/lib/reports/send-report-email";

export const triangulateStudyFunction = inngest.createFunction(
  {
    id: "study-triangulate-preflight",
    retries: 2,
    triggers: [studyTriangulateRequested],
    onFailure: async ({ event, error }) => {
      const { runId, userId } = event.data.event.data;
      await emitRunProgress("study_triangulation", runId, userId, {
        status: "failed",
        progressPct: 100,
        message: "Pre-Flight Study did not complete.",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 320)
            : "Unexpected error during triangulation.",
      }).catch(() => {});
    },
  },
  async ({ event, step }) => {
    const { studyId, runId, userId } = event.data;

    // Step 0: Hydrate Study, Audience, Minds & Creator Persona
    const ctx = await step.run("hydrate-study-context", async () => {
      const db = adminDb();
      await db
        .from("study_runs")
        .update({ started_at: new Date().toISOString() })
        .eq("id", runId)
        .eq("user_id", userId);

      await emitRunProgress("study_triangulation", runId, userId, {
        status: "leg_a_packaging",
        progressPct: 6,
        message: "Loading channel audience, 16 Minds, and Creator Persona…",
      });

      const studyRes = await db
        .from("studies")
        .select("*")
        .eq("id", studyId)
        .eq("user_id", userId)
        .single();
      if (studyRes.error || !studyRes.data) throw new Error("Study not found.");
      const study = studyRes.data;

      const [audRes, mindsRes, personaRes] = await Promise.all([
        db
          .from("audiences")
          .select("*, channels(title,handle,primary_language)")
          .eq("id", study.audience_id)
          .eq("user_id", userId)
          .single(),
        db
          .from("audience_minds")
          .select("*")
          .in("id", study.active_mind_ids)
          .eq("user_id", userId)
          .order("sort_order", { ascending: true }),
        study.persona_id
          ? db
              .from("studio_personas")
              .select("*")
              .eq("id", study.persona_id)
              .eq("user_id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (audRes.error || !audRes.data) throw new Error("Audience not found.");
      const ch = Array.isArray(audRes.data.channels)
        ? audRes.data.channels[0]
        : audRes.data.channels;

      const audienceSummary = [
        `Channel: ${ch?.title || "YouTube Channel"}`,
        audRes.data.psychographics?.tone_preferences || "",
        Array.isArray(audRes.data.psychographics?.core_motivations)
          ? "Motivations: " +
            audRes.data.psychographics.core_motivations.join("; ")
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      return {
        study: {
          id: study.id as string,
          language: (study.language || audRes.data.language || "en") as string,
          titleDraft: study.title_draft as string,
          scriptText: study.script_text as string,
          opening60sText: study.opening_60s_text as string,
          thumbnailPrompt: (study.thumbnail_prompt || "") as string,
          draftThumbnailPath: (study.draft_thumbnail_path || null) as string | null,
          productionMode: study.production_mode as ProductionMode,
          diagnosticQuestions:
            study.diagnostic_questions as DiagnosticQuestion[],
          personaId: (study.persona_id || null) as string | null,
          styleId: (study.style_id || null) as string | null,
          notifyEmails: (study.notify_emails || []) as string[],
        },
        channelTitle: (ch?.title || "YouTube Channel") as string,
        channelHandle: (ch?.handle || null) as string | null,
        audienceSummary,
        outlierPatterns: audRes.data.outlier_patterns || {},
        personaTone: (personaRes.data?.tone_of_voice || "") as string,
        personaVisualRules: (personaRes.data?.visual_style_rules || "") as string,
        minds: (mindsRes.data || []) as PersistedMind[],
      };
    });

    const legAInput: LegAInput = {
      userId,
      studyRunId: runId,
      language: ctx.study.language,
      productionMode: ctx.study.productionMode,
      titleDraft: ctx.study.titleDraft,
      scriptText: ctx.study.scriptText,
      thumbnailPrompt: ctx.study.thumbnailPrompt,
      draftThumbnailPath: ctx.study.draftThumbnailPath,
      personaId: ctx.study.personaId,
      personaTone: ctx.personaTone,
      personaVisualRules: ctx.personaVisualRules,
      styleId: ctx.study.styleId,
      audienceSummary: ctx.audienceSummary,
      outlierPatterns: ctx.outlierPatterns,
    };

    // Leg A Step 1: Concept challenger routes (2 if draft uploaded, else 3)
    const concepts = await step.run("leg-a-concept-routes", async () => {
      await emitRunProgress("study_triangulation", runId, userId, {
        status: "leg_a_packaging",
        progressPct: 12,
        message: ctx.study.draftThumbnailPath
          ? "Designing 2 AI challenger routes to test against your draft thumbnail…"
          : "Designing 3 distinct packaging routes (A, B, C)…",
      });
      return runWithWorkerUser(userId, () => conceptPackagingRoutes(legAInput));
    });

    // Leg A Step 2: Render & score all 3 options in parallel (each memoized independently!)
    const optionTasks: Promise<unknown>[] = [];
    if (ctx.study.draftThumbnailPath) {
      optionTasks.push(
        step.run("leg-a-option-A-draft", async () => {
          const r = await runWithWorkerUser(userId, () =>
            processUserDraftOptionA(legAInput),
          );
          await emitRunProgress("study_triangulation", runId, userId, {
            status: "leg_a_packaging",
            progressPct: 20,
            message: "Scored your draft thumbnail as Option A…",
          });
          return r;
        }),
      );
    }

    concepts.forEach((concept, idx) => {
      optionTasks.push(
        step.run(`leg-a-option-${concept.option_key}`, async () => {
          const r = await runWithWorkerUser(userId, () =>
            renderAndScoreOption(
              legAInput,
              concept,
              idx + 1,
              concepts.length,
            ),
          );
          await emitRunProgress("study_triangulation", runId, userId, {
            status: "leg_a_packaging",
            progressPct: 22 + idx * 4,
            message: `Rendered & scored Packaging Option ${concept.option_key}…`,
          });
          return r;
        }),
      );
    });

    await Promise.all(optionTasks);

    const optionsBrief: PackagedOptionBrief[] = await step.run(
      "load-leg-a-options",
      async () => {
        const res = await adminDb()
          .from("packaging_options")
          .select("option_key,title,image_path,jpg_path")
          .eq("study_run_id", runId)
          .order("option_key", { ascending: true });
        if (res.error || !res.data?.length) {
          throw new Error("Packaging options missing after Leg A.");
        }
        return res.data as PackagedOptionBrief[];
      },
    );

    // Leg B Pass 1: 4 parallel batches of 4 Minds = 16 independent cold reactions
    await emitRunProgress("study_triangulation", runId, userId, {
      status: "leg_b_pass1",
      progressPct: 35,
      message: `Running Pass 1 cold reactions across ${ctx.minds.length} Minds (blind randomized order)…`,
    });

    const batches: { mind: PersistedMind; globalIndex: number }[][] = [];
    for (let i = 0; i < ctx.minds.length; i += 4) {
      batches.push(
        ctx.minds
          .slice(i, i + 4)
          .map((mind, offset) => ({ mind, globalIndex: i + offset })),
      );
    }

    const batchResults = await Promise.all(
      batches.map((mindsBatch, bIdx) =>
        step.run(`leg-b-pass1-batch-${bIdx + 1}`, async () => {
          const res = await runWithWorkerUser(userId, () =>
            runMindsPass1Batch({
              userId,
              studyRunId: runId,
              language: ctx.study.language,
              opening60s: ctx.study.opening60sText,
              questions: ctx.study.diagnosticQuestions,
              options: optionsBrief,
              mindsBatch,
            }),
          );
          await emitRunProgress("study_triangulation", runId, userId, {
            status: "leg_b_pass1",
            progressPct: 42 + (bIdx + 1) * 6,
            message: `Pass 1 batch ${bIdx + 1}/${batches.length} complete…`,
          });
          return res;
        }),
      ),
    );

    const totalFailedMinds = batchResults.reduce((n, b) => n + b.failed, 0);
    const totalSucceededMinds = batchResults.reduce((n, b) => n + b.succeeded, 0);
    if (totalSucceededMinds < Math.max(8, ctx.minds.length - 2)) {
      throw new Error(
        `Too many Minds failed Pass 1 (${totalFailedMinds}/${ctx.minds.length}). Check your AI key quota.`,
      );
    }

    // Leg B Pass 2: Comment-section skepticism & shareability stress-test
    await step.run("leg-b-pass2-stress-test", async () => {
      await emitRunProgress("study_triangulation", runId, userId, {
        status: "leg_b_pass2",
        progressPct: 70,
        message: "Running Pass 2: comment-section skepticism & shareability stress-test…",
      });
      await runWithWorkerUser(userId, () =>
        runMindsPass2StressTest({
          userId,
          studyRunId: runId,
          language: ctx.study.language,
          opening60s: ctx.study.opening60sText,
          options: optionsBrief,
          minds: ctx.minds,
        }),
      );
    });

    // Leg C: Full-Script Editorial Angle Strategist
    const strategistOutput = await step.run("leg-c-editorial-strategist", async () => {
      await emitRunProgress("study_triangulation", runId, userId, {
        status: "leg_c_strategist",
        progressPct: 82,
        message: "Auditing full script for buried angles & retention cliffs…",
      });

      const db = adminDb();
      const [optsRes, respRes] = await Promise.all([
        db
          .from("packaging_options")
          .select("option_key,is_user_draft,angle_label,title,visual_rationale,klickz_score,designer_redline")
          .eq("study_run_id", runId)
          .order("option_key", { ascending: true }),
        db
          .from("mind_responses")
          .select("mind_id,pass_number,chosen_option,click_confidence,verbatim_click_reason,top_hesitation_killer,comment_skepticism_quote,retention_cliff_flag,retention_cliff_note")
          .eq("study_run_id", runId),
      ]);

      return runWithWorkerUser(userId, () =>
        runEditorialStrategist({
          language: ctx.study.language,
          productionMode: ctx.study.productionMode,
          scriptText: ctx.study.scriptText,
          titleDraft: ctx.study.titleDraft,
          personaTone: ctx.personaTone,
          channelTitle: ctx.channelTitle,
          outlierPatterns: ctx.outlierPatterns,
          packagingSummary: (optsRes.data || []).map((o) => ({
            optionKey: o.option_key,
            isUserDraft: o.is_user_draft,
            title: o.title,
            overallScore: o.klickz_score?.overall ?? null,
            primaryFix: o.designer_redline?.primaryFix ?? null,
          })),
          mindReactionsSummary: respRes.data || [],
        }),
      );
    });

    // Final Step 1: Compile Report Snapshot + Render PDF & Markdown + Upload to Storage
    const compiled = await step.run("compile-report-and-deliverables", async () => {
      await emitRunProgress("study_triangulation", runId, userId, {
        status: "compiling_deliverables",
        progressPct: 92,
        message: "Compiling Executive Report, PDF dossier, and Markdown brief…",
      });

      const db = adminDb();
      const [optsRes, respRes] = await Promise.all([
        db
          .from("packaging_options")
          .select("*")
          .eq("study_run_id", runId)
          .order("option_key", { ascending: true }),
        db.from("mind_responses").select("*").eq("study_run_id", runId),
      ]);

      const p1ByMind = new Map(
        (respRes.data || [])
          .filter((r) => r.pass_number === 1)
          .map((r) => [r.mind_id as string, r]),
      );
      const p2ByMind = new Map(
        (respRes.data || [])
          .filter((r) => r.pass_number === 2)
          .map((r) => [r.mind_id as string, r]),
      );

      const voices: ReportMindVoice[] = ctx.minds
        .filter((m) => p1ByMind.has(m.id))
        .map((m) => {
          const p1 = p1ByMind.get(m.id)!;
          const p2 = p2ByMind.get(m.id);
          return {
            mindId: m.id,
            name: m.name,
            avatarSeed: m.avatar_seed,
            role: m.role,
            archetype: m.archetype,
            ageBracket: m.age_bracket,
            clickBar: m.click_bar,
            chosenOption: p1.chosen_option,
            clickConfidence: p1.click_confidence,
            verbatimClickReason: p1.verbatim_click_reason,
            topHesitationKiller: p1.top_hesitation_killer,
            questionAnswers: Array.isArray(p1.question_answers)
              ? p1.question_answers
              : [],
            commentSkepticismQuote: p2?.comment_skepticism_quote ?? null,
            shareabilityScore: p2?.shareability_score ?? null,
            retentionCliffFlag: Boolean(
              p1.retention_cliff_flag || p2?.retention_cliff_flag,
            ),
            retentionCliffNote:
              p1.retention_cliff_note || p2?.retention_cliff_note || null,
          };
        });

      const options: Omit<ReportOptionSnapshot, "voteCount" | "voteSharePct">[] = (
        optsRes.data || []
      ).map((o) => ({
        optionKey: o.option_key as "A" | "B" | "C",
        isUserDraft: Boolean(o.is_user_draft),
        angleLabel: o.angle_label,
        title: o.title,
        visualRationale: o.visual_rationale,
        emotionalLever: o.emotional_lever,
        footageGrounding: o.footage_grounding ?? null,
        imagePath: o.image_path ?? null,
        jpgPath: o.jpg_path ?? null,
        klickzScore: o.klickz_score ?? null,
        feedCheck: o.feed_check ?? null,
        designerRedline: o.designer_redline ?? null,
      }));

      const warnings: string[] = [];
      if (totalFailedMinds > 0) {
        warnings.push(
          `${totalFailedMinds} Mind(s) timed out during Pass 1; results reflect ${voices.length} completed Minds.`,
        );
      }

      const payload = compileReportPayload({
        language: ctx.study.language,
        productionMode: ctx.study.productionMode,
        channelTitle: ctx.channelTitle,
        channelHandle: ctx.channelHandle,
        studyTitleDraft: ctx.study.titleDraft,
        diagnosticQuestions: ctx.study.diagnosticQuestions,
        options,
        voices,
        strategist: strategistOutput,
        warnings,
      });

      // Check if slug already exists on retry
      const existing = await db
        .from("study_reports")
        .select("slug")
        .eq("study_run_id", runId)
        .maybeSingle();
      const slug = existing.data?.slug || generateReportSlug();
      const reportUrl = `${appOrigin()}/reports/${slug}`;

      // Load small JPEG data URLs for PDF embedding
      const thumbDataUrls: Partial<Record<"A" | "B" | "C", string>> = {};
      await Promise.all(
        options.map(async (opt) => {
          const p = opt.jpgPath || opt.imagePath;
          if (!p) return;
          try {
            const raw = await ownedAsset(db, userId, p);
            const resized = await sharp(raw)
              .rotate()
              .resize({ width: 480, withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toBuffer();
            thumbDataUrls[opt.optionKey] =
              `data:image/jpeg;base64,${resized.toString("base64")}`;
          } catch {
            // Skip image in PDF if unavailable
          }
        }),
      );

      const markdownContent = renderReportMarkdown(payload, reportUrl);
      const pdfBuffer = await renderReportPdfBuffer(
        payload,
        thumbDataUrls,
        reportUrl,
      );

      const pdfPath = `${userId}/reports/${slug}.pdf`;
      const markdownPath = `${userId}/reports/${slug}.md`;

      await Promise.all([
        db.storage.from("studio-assets").upload(pdfPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        }),
        db.storage
          .from("studio-assets")
          .upload(markdownPath, Buffer.from(markdownContent, "utf-8"), {
            contentType: "text/markdown; charset=utf-8",
            upsert: true,
          }),
      ]);

      const repUp = await db.from("study_reports").upsert(
        {
          study_run_id: runId,
          user_id: userId,
          slug,
          is_public: true,
          language: ctx.study.language,
          production_mode: ctx.study.productionMode,
          pdf_path: pdfPath,
          markdown_path: markdownPath,
          payload,
        },
        { onConflict: "study_run_id" },
      );
      if (repUp.error) throw repUp.error;

      return { slug, reportUrl, pdfPath, markdownPath };
    });

    // Final Step 2: Deliver PDF + Markdown + Report Link via Resend (idempotent)
    await step.run("deliver-email-report", async () => {
      const db = adminDb();
      const runRow = await db
        .from("study_runs")
        .select("email_sent_at")
        .eq("id", runId)
        .single();
      if (runRow.data?.email_sent_at) return { skipped: "already sent" };

      const [userRes, repRes, pdfBuf, mdBuf] = await Promise.all([
        db.auth.admin.getUserById(userId),
        db
          .from("study_reports")
          .select("payload")
          .eq("study_run_id", runId)
          .single(),
        ownedAsset(db, userId, compiled.pdfPath),
        ownedAsset(db, userId, compiled.markdownPath),
      ]);

      const recipients = [
        ...(userRes.data?.user?.email ? [userRes.data.user.email] : []),
        ...ctx.study.notifyEmails,
      ];

      try {
        const sent = await sendPreFlightReportEmail({
          to: recipients,
          slug: compiled.slug,
          reportUrl: compiled.reportUrl,
          report: repRes.data?.payload,
          pdfBuffer: pdfBuf,
          markdownContent: mdBuf.toString("utf-8"),
        });
        if (sent.id) {
          await db
            .from("study_runs")
            .update({ email_sent_at: new Date().toISOString() })
            .eq("id", runId);
        }
        return sent;
      } catch (err) {
        // Log email failure without erasing the completed web report
        console.error(
          "[preflight] email delivery failed:",
          err instanceof Error ? err.message : err,
        );
        return { error: err instanceof Error ? err.message : "email failed" };
      }
    });

    await emitRunProgress("study_triangulation", runId, userId, {
      status: "completed",
      progressPct: 100,
      message: "Executive Pre-Flight Report ready & emailed.",
      metadata: { slug: compiled.slug, reportUrl: compiled.reportUrl },
    });

    return { slug: compiled.slug, reportUrl: compiled.reportUrl };
  },
);
