import { z } from "zod";
import { NextResponse } from "next/server";
import { authenticated, failure } from "@/lib/server";
import { sameOrigin } from "@/lib/crypto";
import { limitedJson } from "@/lib/oauth/http";
import { userKeys } from "@/lib/provider-context";
import { channelVideos } from "@/lib/youtube";
import { youtubeVideoId } from "@/lib/video-context";
import { fetchReference } from "@/lib/reference";
import { saveOwnedReference } from "@/lib/signed-upload";
import { extractPalette } from "@/lib/palette";
import { assertUniqueProfileName, profileNameTakenError } from "@/lib/profile-name";
import { AppError } from "@/lib/validation";

// Study a thumbnail style from a YouTube video link or channel link and save it as
// a private style: up to 3 real thumbnails as references plus their measured palette.
// A single video needs no YouTube key (its thumbnail is public). A channel needs the
// user's own YouTube Data API key to list its videos. No AI provider is called here;
// prepare_profile can add a written style brief afterwards.
const studyInput = z.object({
  url: z.string().trim().min(1).max(500),
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(80).optional(),
  notes: z.string().max(800).default(""),
  order: z.enum(["recent", "popular"]).default("popular"),
  videoIds: z.array(z.string().regex(/^[\w-]{11}$/)).min(1).max(3).optional(),
});

function isVideoLink(url: string) {
  try {
    const u = new URL(url);
    return u.hostname === "youtu.be" || u.pathname === "/watch" || /^\/(shorts|live|embed)\//.test(u.pathname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { db, user, oauth } = await authenticated(request);
    if (!oauth) sameOrigin(request);
    if (oauth && !oauth.scope.includes("studio:write"))
      throw new AppError(403, "Allow workspace write access to save a style.");
    const input = studyInput.parse(await limitedJson(request, 4000));
    let videoIds: string[];
    let channelId: string | undefined;
    let channelName = "";
    if (input.videoIds) videoIds = input.videoIds;
    else if (isVideoLink(input.url)) videoIds = [youtubeVideoId(input.url)];
    else {
      const keys = await userKeys(db, user.id);
      if (!keys.youtube)
        throw new AppError(
          403,
          "Studying a whole channel needs your own YouTube Data API key in Connections. You can paste a single video link instead.",
        );
      const page = await channelVideos(keys.youtube, input.url, input.order);
      videoIds = page.videos.slice(0, 3).map((v) => v.id);
      channelId = page.channel.id;
      channelName = page.channel.name;
      if (!videoIds.length) throw new AppError(404, "This channel has no public videos to study.");
    }
    const images = await Promise.all(
      videoIds.map((id) => fetchReference(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, 0, ["i.ytimg.com"])),
    );
    const palette = await extractPalette(images);
    const name = (input.name || channelName || `Style from ${videoIds[0]}`).slice(0, 80);
    if (name.trim().length < 3) throw new AppError(400, "Name must be at least 3 characters");
    const existing = await db.from("studio_styles").select("id,name").eq("user_id", user.id);
    if (existing.error) throw existing.error;
    assertUniqueProfileName(existing.data || [], name, "style");
    const refs: string[] = [];
    for (const image of images) refs.push(await saveOwnedReference(db, user.id, image));
    const unique = [...new Set(refs)];
    const colors = palette.map((c) => c.hex);
    const notes = (input.notes || `Measured palette: ${colors.join(", ")}.`).slice(0, 800);
    const row = {
      name,
      notes,
      refs: unique,
      user_id: user.id,
      profile_status: "draft",
      source: { kind: "youtube", ...(channelId ? { channelId } : {}), videoIds, palette: colors },
    };
    const result = await db.from("studio_styles").insert(row).select("*").single();
    if (result.error) {
      if ((result.error as { code?: string }).code === "23505")
        throw new AppError(409, profileNameTakenError("style", name));
      throw result.error;
    }
    return NextResponse.json(
      {
        profile: result.data,
        palette,
        videoIds,
        method: "measured-palette",
        notice: "Palette measured from the thumbnails' pixels. Studied thumbnails are private references; selecting them does not grant rights to reuse their contents. Use prepare_profile to add a written style brief.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
