import { seal, unseal } from "./crypto";
import { semanticDigest } from "./diagnostics";
import { AppError } from "./validation";
import type { Evaluation } from "./types";
export function signDiagnostic(value: Evaluation) {
  return {
    ...value,
    proof: seal({ digest: semanticDigest(value) }, "diagnostic-proof"),
  };
}
export function verifyDiagnostic(value: Evaluation) {
  const { proof, ...score } = value;
  if (
    !proof ||
    unseal<{ digest: string }>(proof, "diagnostic-proof").digest !==
      semanticDigest(score)
  )
    throw new AppError(
      409,
      "Analyze this thumbnail through the app before creating a fix plan.",
    );
}
