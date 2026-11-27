import { channelIngestRequested, inngest } from "../client";
import { adminDb } from "@/lib/admin-db";
import { runWithWorkerUser } from "@/lib/worker-keys";
import { emitRunProgress } from "@/lib/run-progress-server";
import {
  ingestChannelSnapshot,
  videoCommentThreads,
  type IngestedChannelVideo,
} from "@/lib/youtube";
import { extractYoutubeTranscript } from "@/lib/transcript-provider";
import { callStructuredJson } from "@/lib/llm-router";
import {
  audienceDistributionSchema,
  mindBatchSchema,
  type AudienceMindDraft,
} from "@/lib/schemas/audience";
import { providerKey } from "@/lib/provider-context";

export const ingestChannelFunction = inngest.createFunction(
  {
    id: "channel-ingest-and-minds",
    retries: 2,
    triggers: [channelIngestRequested],
    onFailure: async ({ event, error }) => {
      const { runId, userId } = event.data.event.data;
      await emitRunProgress("channel_ingestion", runId, userId, {
        status: "failed",
        progressPct: 100,
        message: "Channel audience build failed.",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Unexpected error during channel ingestion.",
      }).catch(() => {});
    },
  },
  async ({ event, step }) => {
    const { runId, userId, channelInput } = event.data;

    // Step 1: Resolve YouTube channel, 40 recent videos, outliers, comments & transcripts
    const signals = await step.run("extract-youtube-signals", async () => {
      await emitRunProgress("channel_ingestion", runId, userId, {
        status: "extracting_signals",
        progressPct: 12,
        message: "Resolving YouTube channel & last 40 videos…",
      });

      return runWithWorkerUser(userId, async () => {
        const ytKey = providerKey("youtube");
        const snapshot = await ingestChannelSnapshot(ytKey, channelInput, 40);
        const db = adminDb();

        const chUpsert = await db
          .from("channels")
          .upsert(
            {
              user_id: userId,
              youtube_channel_id: snapshot.channel.youtubeChannelId,
              handle: snapshot.channel.handle,
              title: snapshot.channel.title,
              description: snapshot.channel.description,
              primary_language: snapshot.channel.primaryLanguage,
              avatar_url: snapshot.channel.avatarUrl,
              subscriber_count: snapshot.channel.subscriberCount,
              video_count: snapshot.channel.videoCount,
              uploads_playlist_id: snapshot.channel.uploadsPlaylistId,
              median_views: snapshot.channel.medianViews,
              last_ingested_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,youtube_channel_id" },
          )
          .select("id")
          .single();
        if (chUpsert.error || !chUpsert.data) throw chUpsert.error;
        const channelId = chUpsert.data.id as string;

        await db
          .from("channel_ingestion_runs")
          .update({ channel_id: channelId })
          .eq("id", runId)
          .eq("user_id", userId);

        const byOutlier = [...snapshot.videos].sort(
          (a, b) => b.outlierRatio - a.outlierRatio,
        );
        const topOutliers = byOutlier.slice(0, 5);
        const recentNonDup = snapshot.videos
          .filter(
            (v) =>
              !topOutliers.some((o) => o.youtubeVideoId === v.youtubeVideoId),
          )
          .slice(0, 2);
        const sampleForDeep = [...topOutliers.slice(0, 3), ...recentNonDup];

        await emitRunProgress("channel_ingestion", runId, userId, {
          status: "extracting_signals",
          progressPct: 24,
          message: `Extracting comments & transcripts from ${sampleForDeep.length} key videos…`,
          metadata: {
            channelId,
            videoCount: snapshot.videos.length,
            medianViews: snapshot.channel.medianViews,
          },
        });

        const [commentsList, transcriptsList] = await Promise.all([
          Promise.all(
            topOutliers.map(async (v) => ({
              videoId: v.youtubeVideoId,
              comments: await videoCommentThreads(ytKey, v.youtubeVideoId, 20),
            })),
          ),
          Promise.all(
            sampleForDeep.map(async (v) => ({
              videoId: v.youtubeVideoId,
              result: await extractYoutubeTranscript(v.youtubeVideoId),
            })),
          ),
        ]);

        const commentsById = new Map(
          commentsList.map((c) => [c.videoId, c.comments]),
        );
        const transcriptsById = new Map(
          transcriptsList.map((t) => [t.videoId, t.result]),
        );

        // Refine detected language if Gemini returned a spoken language
        const detectedLang =
          transcriptsList.find((t) => t.result.language)?.result.language ||
          snapshot.channel.primaryLanguage;

        if (detectedLang !== snapshot.channel.primaryLanguage) {
          await db
            .from("channels")
            .update({ primary_language: detectedLang })
            .eq("id", channelId);
        }

        if (snapshot.videos.length) {
          const rows = snapshot.videos.map((v: IngestedChannelVideo) => {
            const tr = transcriptsById.get(v.youtubeVideoId);
            return {
              channel_id: channelId,
              user_id: userId,
              youtube_video_id: v.youtubeVideoId,
              title: v.title,
              description: v.description,
              view_count: v.viewCount,
              like_count: v.likeCount,
              comment_count: v.commentCount,
              duration_sec: v.durationSec,
              published_at: v.publishedAt,
              outlier_ratio: v.outlierRatio,
              thumbnail_url: v.thumbnailUrl,
              transcript_excerpt: tr?.transcript ?? null,
              transcript_source: tr?.source ?? null,
              top_comments: commentsById.get(v.youtubeVideoId) ?? [],
            };
          });
          await db
            .from("channel_videos")
            .upsert(rows, { onConflict: "channel_id,youtube_video_id" });
        }

        return {
          channelId,
          channel: { ...snapshot.channel, primaryLanguage: detectedLang },
          topOutliers: byOutlier.slice(0, 8),
          bottomFlops: byOutlier.slice(-4),
          commentsSample: commentsList.flatMap((c) =>
            c.comments.slice(0, 8).map((cm) => ({
              videoId: c.videoId,
              text: cm.text,
              likes: cm.likes,
            })),
          ),
          transcriptsSample: transcriptsList
            .filter((t) => t.result.transcript)
            .map((t) => ({
              videoId: t.videoId,
              title:
                snapshot.videos.find((v) => v.youtubeVideoId === t.videoId)
                  ?.title || "",
              excerpt: t.result.transcript!.slice(0, 2200),
            })),
        };
      });
    });

    // Step 2: Synthesize Demographic & Psychographic Distributions
    const audienceData = await step.run("build-distributions", async () => {
      await emitRunProgress("channel_ingestion", runId, userId, {
        status: "building_distributions",
        progressPct: 48,
        message: "Building demographic & psychographic audience distributions…",
      });

      return runWithWorkerUser(userId, async () => {
        const lang = signals.channel.primaryLanguage;
        const { data } = await callStructuredJson({
          role: "ingestion",
          schema: audienceDistributionSchema,
          maxTokens: 3500,
          system: `You are an elite YouTube Audience Intelligence Researcher. Analyze real channel performance outliers, comments, and spoken transcripts to build a grounded, unsycophantic demographic and psychographic audience model.
CRITICAL LANGUAGE RULE: Write ALL prose, labels, themes, and patterns in natural "${lang}" (matching the channel's audience language).
Never invent fake analytics numbers not grounded in the signals; give realistic audience segment distributions and sharp skepticism patterns observed from comments and flops.`,
          userPrompt: JSON.stringify({
            channel: signals.channel,
            topOutliers: signals.topOutliers.map((v) => ({
              title: v.title,
              views: v.viewCount,
              outlierRatio: v.outlierRatio,
            })),
            underperformers: signals.bottomFlops.map((v) => ({
              title: v.title,
              views: v.viewCount,
              outlierRatio: v.outlierRatio,
            })),
            commentSignals: signals.commentsSample.slice(0, 35),
            transcriptExcerpts: signals.transcriptsSample,
            requiredJsonShape: {
              primary_language: lang,
              audience_summary: "string",
              demographics: {
                age_bands: [{ label: "25-34", share_pct: 40 }],
                geo_and_culture: "string",
                viewer_tenure_split: "string",
              },
              psychographics: {
                core_motivations: ["string (3-7)"],
                recurring_pain_points: ["string (3-7)"],
                skepticism_patterns: ["string (3-7)"],
                tone_preferences: "string",
              },
              comment_themes: [
                {
                  theme: "string",
                  sentiment: "positive|critical|curious|debated",
                  example_signal: "string",
                },
              ],
              outlier_patterns: {
                what_wins: ["string"],
                what_flops: ["string"],
                winning_title_mechanics: ["string"],
              },
            },
          }),
        });

        const db = adminDb();
        const prev = await db
          .from("audiences")
          .select("version")
          .eq("channel_id", signals.channelId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextVersion = (prev.data?.version ?? 0) + 1;

        const inserted = await db
          .from("audiences")
          .insert({
            channel_id: signals.channelId,
            user_id: userId,
            version: nextVersion,
            language: data.primary_language || lang,
            status: "building",
            demographics: data.demographics,
            psychographics: data.psychographics,
            comment_themes: data.comment_themes,
            outlier_patterns: data.outlier_patterns,
          })
          .select("id")
          .single();
        if (inserted.error || !inserted.data) throw inserted.error;

        return {
          audienceId: inserted.data.id as string,
          distribution: data,
        };
      });
    });

    // Step 3: Prepare 16 Stratified Synthetic Audience Minds (2 parallel batches of 8)
    await step.run("prepare-16-minds", async () => {
      await emitRunProgress("channel_ingestion", runId, userId, {
        status: "preparing_minds",
        progressPct: 72,
        message: "Preparing 16 calibrated synthetic audience Minds…",
      });

      await runWithWorkerUser(userId, async () => {
        const lang =
          audienceData.distribution.primary_language ||
          signals.channel.primaryLanguage;

        const buildBatch = async (
          batchNum: 1 | 2,
          quota: string,
          avoidNames: string[],
        ) => {
          const { data } = await callStructuredJson({
            role: "ingestion",
            schema: mindBatchSchema,
            maxTokens: 4500,
            system: `You design realistic, distinct synthetic YouTube viewer personas ("Minds") for pre-flight packaging & script testing.
CRITICAL RULES:
1. Write ALL fields (role, knowledge_items, thinking_patterns, skepticism_triggers, sample_voice_quote) in natural "${lang}" matching the channel's real audience. Use culturally authentic everyday first+last names for that audience.
2. Create EXACTLY 8 distinct Minds obeying this archetype split: ${quota}.
3. Calibrate click_bar realistically (1-10): loyalists 5-7, casual_scrollers 7-9, skeptics 8-10, new_viewers 7-9. These are real busy humans scrolling YouTube, NOT sycophantic fans.
4. Every Mind MUST have specific, sharp skepticism_triggers (e.g. clickbait allergy, recycled topics, lack of proof, fake urgency).
5. Avoid these already-used names: ${avoidNames.join(", ") || "none"}.`,
            userPrompt: JSON.stringify({
              batchNumber: batchNum,
              channelTitle: signals.channel.title,
              audienceDistribution: audienceData.distribution,
              requiredJsonShape: {
                minds: [
                  {
                    name: "Full Name",
                    role: "Specific job/life context",
                    archetype: "loyalist|casual_scroller|skeptic|new_viewer",
                    age_bracket: "25-34",
                    click_bar: 8,
                    knowledge_items: ["3-6 specific things they know/follow"],
                    thinking_patterns: ["2-4 how they judge videos quickly"],
                    skepticism_triggers: ["2-4 instant turn-offs / BS detectors"],
                    sample_voice_quote: "A realistic comment they'd write",
                  },
                ],
              },
            }),
          });
          return data.minds;
        };

        const batch1 = await buildBatch(
          1,
          "2 loyalist, 3 casual_scroller, 2 skeptic, 1 new_viewer",
          [],
        );

        await emitRunProgress("channel_ingestion", runId, userId, {
          status: "preparing_minds",
          progressPct: 86,
          message: `Prepared ${batch1.length}/16 Minds… generating second cohort`,
        });

        const batch2 = await buildBatch(
          2,
          "2 loyalist, 2 casual_scroller, 2 skeptic, 2 new_viewer",
          batch1.map((m) => m.name),
        );

        // Deduplicate by lowercase name and cap cleanly at 16
        const seen = new Set<string>();
        const allMinds: AudienceMindDraft[] = [];
        for (const m of [...batch1, ...batch2]) {
          const key = m.name.trim().toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          allMinds.push(m);
          if (allMinds.length >= 16) break;
        }

        const db = adminDb();
        const rows = allMinds.map((m, idx) => ({
          audience_id: audienceData.audienceId,
          user_id: userId,
          sort_order: idx,
          name: m.name.trim(),
          avatar_seed: `${signals.channelId.slice(0, 6)}-${idx}-${m.archetype}`,
          role: m.role.trim(),
          archetype: m.archetype,
          age_bracket: m.age_bracket,
          click_bar: m.click_bar,
          knowledge_items: m.knowledge_items,
          thinking_patterns: m.thinking_patterns,
          skepticism_triggers: m.skepticism_triggers,
          sample_voice_quote: m.sample_voice_quote,
          active: true,
        }));

        const ins = await db.from("audience_minds").insert(rows);
        if (ins.error) throw ins.error;

        await db
          .from("audiences")
          .update({ status: "ready" })
          .eq("id", audienceData.audienceId);
      });
    });

    await emitRunProgress("channel_ingestion", runId, userId, {
      status: "completed",
      progressPct: 100,
      message: "Audience intelligence & 16 Minds ready.",
      metadata: {
        channelId: signals.channelId,
        audienceId: audienceData.audienceId,
      },
    });

    return {
      channelId: signals.channelId,
      audienceId: audienceData.audienceId,
    };
  },
);
