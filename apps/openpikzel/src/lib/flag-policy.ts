import type { ReviewFlag } from "./types";

// Code owns the decision (TypeSafe: "build the candidate list in code", "keep counting and hard rules in
// code"). Jev and the image reviewer each say which review flags look true; these rules then drop the
// flags neither of them could judge from what they were shown, and count words themselves.

export type FlagContext = {
  /** A video title was supplied. Without one, "repeats the title" and "means nothing without the title" can't apply. */
  hasTitle: boolean;
  /** A title, brief or intended promise was supplied, so a figure can be checked against something. */
  hasFacts: boolean;
  /** The people in the image are allowed: a persona, reference images, or the creator's own uploaded thumbnail. */
  peopleAuthorized: boolean;
  /** Marks in the image are allowed: attached reference images or the house style's play badge. */
  marksAuthorized: boolean;
  /** The image review ran and reported the on-image text it read (null = it read none). */
  reviewed: boolean;
  readableText?: string | null;
};

/** Words of on-image text, counted in code. Punctuation alone (¿ ? !) is not a word. */
export function wordCount(text: string) {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean).length;
}

/** The most words on-image text may have before too_many_words applies (playbook: 2-4 words). */
export const maxOnImageWords = 4;

/** Whether a flag a model reported is one it could actually judge here. */
export function keepFlag(flag: ReviewFlag, c: FlagContext): boolean {
  switch (flag) {
    case "text_repeats_title":
    case "depends_on_title":
      return c.hasTitle;
    case "invented_numbers":
      return c.hasFacts;
    case "real_person_without_reference":
      return !c.peopleAuthorized;
    case "logo_or_date_present":
      return !c.marksAuthorized;
    case "too_many_words":
      // When the reviewer read the text, the count decides (see wordFlag), not a model's guess.
      return !c.reviewed;
    default:
      return true;
  }
}

/** too_many_words from the counted words, when the reviewer read the text. */
export function wordFlag(c: FlagContext): boolean {
  return c.reviewed && !!c.readableText && wordCount(c.readableText) > maxOnImageWords;
}
