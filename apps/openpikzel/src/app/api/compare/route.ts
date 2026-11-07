import { z } from "zod";
import { randomBytes } from "node:crypto";
import { authenticated, failure } from "@/lib/server";
import { ownedAsset } from "@/lib/assets";
import { actualPreview, digest, semanticDigest } from "@/lib/diagnostics";
import { seal, unseal } from "@/lib/crypto";
import { AppError } from "@/lib/validation";
type Pair = {
  uid: string;
  candidate: string;
  order: string[];
  expires: number;
  sourceDigests: string[];
  context: ReturnType<typeof comparisonContext>;
};
function comparisonContext(candidate: any) {
  const context = candidate.score?.context || candidate.lineage?.plan;
  return {
    title: candidate.title || "",
    videoBrief: context?.videoBrief || "",
    audience: context?.audience || "",
  };
}
export async function POST(request: Request) {
  try {
    const { db, user, oauth } = await authenticated(request);
    const body = await request.json();
    if (body.token) {
      if (oauth && !oauth.scope.includes("studio:write"))
        throw new AppError(403, "Agent needs write permission.");
      const input = z
          .object({
            token: z.string().max(12000),
            preference: z.enum(["A", "B", "tie", "inconclusive"]),
          })
          .strict()
          .parse(body),
        pair = unseal<Pair>(input.token, "blind-compare");
      if (pair.uid !== user.id || pair.expires <= Date.now())
        throw new AppError(403, "Comparison expired.");
      for (let index = 0; index < pair.order.length; index++) {
        const current = await db
          .from("studio_creations")
          .select("image_path,title,score,lineage")
          .eq("id", pair.order[index])
          .eq("user_id", user.id)
          .single();
        if (
          current.error ||
          !current.data?.image_path ||
          (pair.order[index] === pair.candidate &&
            semanticDigest(comparisonContext(current.data)) !== semanticDigest(pair.context)) ||
          digest(await ownedAsset(db, user.id, current.data.image_path)) !==
            pair.sourceDigests[index]
        )
          throw new AppError(
            409,
            "A compared source changed or was removed. Start a new comparison.",
          );
      }
      const chosen =
        input.preference === "A"
          ? pair.order[0]
          : input.preference === "B"
            ? pair.order[1]
            : null;
      const review = {
        preference: input.preference,
        context: pair.context,
        order: pair.order,
        chosenId: chosen,
        decidedAt: new Date().toISOString(),
      };
      const r = await db
        .from("studio_creations")
        .update({ review })
        .eq("id", pair.candidate)
        .eq("user_id", user.id);
      if (r.error) throw r.error;
      return Response.json({
        review,
        keptOriginal: chosen !== pair.candidate,
        note: "Both images remain saved. A human preference is not measured CTR or automated preservation verification.",
      });
    }
    const { creationId } = z
      .object({ creationId: z.string().uuid() })
      .strict()
      .parse(body);
    const candidate = await db
      .from("studio_creations")
      .select("id,parent_id,image_path,title,score,lineage")
      .eq("id", creationId)
      .eq("user_id", user.id)
      .single();
    if (
      candidate.error ||
      !candidate.data?.parent_id ||
      !candidate.data.image_path
    )
      throw new AppError(
        400,
        "Choose a variant with its original still available.",
      );
    const original = await db
      .from("studio_creations")
      .select("id,image_path")
      .eq("id", candidate.data.parent_id)
      .eq("user_id", user.id)
      .single();
    if (original.error || !original.data?.image_path)
      throw new AppError(404, "Original is no longer available.");
    const seed = randomBytes(16).toString("hex"),
      order =
        parseInt(digest(seed).slice(0, 2), 16) % 2
          ? [candidate.data, original.data]
          : [original.data, candidate.data];
    const sourceDigests: string[] = [];
    const options = await Promise.all(
      order.map(async (item, index) => {
        const bytes = await ownedAsset(db, user.id, item.image_path),
          preview = await actualPreview(bytes),
          signed = await db.storage
            .from("studio-assets")
            .createSignedUrl(item.image_path, 300);
        sourceDigests[index] = digest(bytes);
        if (signed.error) throw signed.error;
        return {
          label: index ? "B" : "A",
          preview: `data:image/jpeg;base64,${preview.toString("base64")}`,
          fullImage: signed.data.signedUrl,
        };
      }),
    );
    return Response.json(
      {
        title: candidate.data.title,
        context: comparisonContext(candidate.data),
        options,
        token: seal(
          {
            uid: user.id,
            candidate: creationId,
            order: order.map((i) => i.id),
            sourceDigests,
            context: comparisonContext(candidate.data),
            expires: Date.now() + 300000,
          } satisfies Pair,
          "blind-compare",
        ),
        notice:
          "Randomized A/B order, no prior scores or edit rationale. Judge fidelity and readability; tie or inconclusive keeps the original. No AI call.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
