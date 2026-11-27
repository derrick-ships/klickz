import "server-only";
import { googleYoutubeTranscript } from "./google";
import { hasProvider, providerKey } from "./provider-context";

export type TranscriptResult = {
  transcript: string | null;
  language?: string;
  source: "gemini" | "transcript_api" | "unavailable";
};

async function fetchFromTranscriptApi(
  videoId: string,
  apiKey: string,
): Promise<{ transcript: string; language?: string } | null> {
  const url = `https://transcriptapi.com/api/v2/youtube/transcript?video_url=${encodeURIComponent(videoId)}&format=text`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const payload = await r.json();
  const text =
    typeof payload?.transcript === "string"
      ? payload.transcript
      : Array.isArray(payload?.transcript)
        ? payload.transcript
            .map((seg: { text?: string }) => seg?.text || "")
            .join(" ")
        : "";
  if (!text.trim()) return null;
  return {
    transcript: text.trim().slice(0, 4000),
    language:
      typeof payload?.language === "string"
        ? payload.language.split("-")[0].toLowerCase()
        : undefined,
  };
}

/**
 * Unified YouTube video transcript extractor:
 * 1. Default: Google Gemini native YouTube URL transcription (zero extra setup; works even when captions are disabled).
 * 2. Optional: If the user connected a `transcript` (`transcriptapi.com`) key and has no Google key (or Gemini fails), uses Transcript API.
 * Never crashes channel ingestion if a single video has no speech/captions.
 */
export async function extractYoutubeTranscript(
  videoId: string,
): Promise<TranscriptResult> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  if (hasProvider("google")) {
    try {
      const res = await googleYoutubeTranscript(videoUrl);
      if (res.transcript.trim()) {
        return {
          transcript: res.transcript.trim().slice(0, 4000),
          language: res.language,
          source: "gemini",
        };
      }
    } catch {
      // Fall through to optional Transcript API if connected
    }
  }

  if (hasProvider("transcript")) {
    try {
      const res = await fetchFromTranscriptApi(
        videoId,
        providerKey("transcript"),
      );
      if (res?.transcript) {
        return {
          transcript: res.transcript,
          language: res.language,
          source: "transcript_api",
        };
      }
    } catch {
      // Graceful fallback
    }
  }

  return { transcript: null, source: "unavailable" };
}
