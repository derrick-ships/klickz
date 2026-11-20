import { it, expect } from "vitest";
import { mentionSegments, unmention, mentioned } from "../src/components/creative/mention-list";
import { chatDeletionPlan } from "../src/lib/chat-delete";
import { commitChatDeletion } from "../src/lib/chat-delete-commit";
import { personaIdentityContract } from "../src/lib/instructions";

it("marks every saved-persona mention, longest name first, and leaves other @text alone", () => {
  const parts = mentionSegments("@Ana Maria and @Ana talk to @nobody, then @JP Serna.", ["Ana", "Ana Maria", "JP Serna"]);
  expect(parts.filter((p) => p.mention).map((p) => p.text)).toEqual(["@Ana Maria", "@Ana", "@JP Serna"]);
  expect(parts.map((p) => p.text).join("")).toBe("@Ana Maria and @Ana talk to @nobody, then @JP Serna.");
  expect(mentionSegments("email me@Ana", ["Ana"]).some((p) => p.mention)).toBe(false);
});

it("removes the @ from a persona that is taken out, keeping the words", () => {
  expect(unmention("@Abelardo and @JP Serna in a podcast", "JP Serna")).toBe("@Abelardo and JP Serna in a podcast");
  expect(mentioned("@abelardo smiles", "Abelardo")).toBe(true);
});

it("deletes a chat's thumbnails, their PNG and JPG files and chat-only references, keeping shared files", () => {
  const u = "u1";
  const creations = [
    { id: "a", conversation_id: "c1", image_path: u + "/creations/a.png", reference_path: u + "/references/r1.png", reference_paths: [u + "/references/r1.png", u + "/references/shared.png"] },
    { id: "b", conversation_id: "c1", image_path: u + "/references/upload.png", reference_path: null, reference_paths: [] },
    { id: "d", conversation_id: "c1", image_path: null, reference_path: null, reference_paths: [u + "/persona/face.png"] },
    { id: "x", conversation_id: "c2", image_path: u + "/creations/x.png", reference_path: null, reference_paths: [u + "/references/shared.png"] },
  ];
  const plan = chatDeletionPlan("c1", creations, [u + "/persona/face.png"]);
  expect(plan.creationIds).toEqual(["a", "b", "d"]);
  expect(plan.paths.sort()).toEqual([u + "/creations/a.jpg", u + "/creations/a.png", u + "/references/r1.png", u + "/references/upload.png"].sort());
});

it("reports whether a failed chat delete changed any thumbnail rows", async () => {
  const fail = async () => { throw new Error("failed"); };
  expect(await commitChatDeletion(["a"], fail, async () => {})).toBe("failed-nothing-changed");
  expect(await commitChatDeletion(["a"], async () => {}, fail)).toBe("partial");
  expect(await commitChatDeletion([], async () => {}, fail)).toBe("failed-nothing-changed");
  expect(await commitChatDeletion(["a"], async () => {}, async () => {})).toBe("done");
  let calls = 0;
  expect(await commitChatDeletion(["a", "b"], async () => { if (++calls === 2) throw new Error("failed"); }, async () => {})).toBe("partial");
});

it("tells the image model to keep several people distinct", () => {
  expect(personaIdentityContract("Abelardo", 1, 2, 2)).toContain("2 named people");
  expect(personaIdentityContract("Abelardo", 1, 4)).toContain("Do not introduce a different person.");
});
