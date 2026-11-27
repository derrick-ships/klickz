import { randomBytes } from "node:crypto";
import type {
  DiagnosticQuestion,
  ExecutiveVerdictCode,
  ProductionMode,
  ReportMindVoice,
  ReportOptionSnapshot,
  ReportPayload,
  StrategistOutput,
} from "../schemas/study";

export function generateReportSlug(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * 100% deterministic Executive Verdict & Click-Share math (never delegated to an LLM).
 */
export function computeDeterministicVerdict(params: {
  language: string;
  options: { optionKey: "A" | "B" | "C"; title: string }[];
  votes: ("A" | "B" | "C" | "none_keep_scrolling")[];
  retentionSeverity: "low" | "medium" | "high";
}): {
  code: ExecutiveVerdictCode;
  headline: string;
  winningOptionKey: "A" | "B" | "C" | null;
  winningTitle: string | null;
  clickShare: ReportPayload["verdict"]["clickShare"];
} {
  const total = Math.max(1, params.votes.length);
  const counts = { A: 0, B: 0, C: 0, none_keep_scrolling: 0 };
  for (const v of params.votes) {
    if (v in counts) counts[v]++;
  }
  const pct = (n: number) => Math.round((n / total) * 100);
  const clickShare = {
    A: { count: counts.A, pct: pct(counts.A) },
    B: { count: counts.B, pct: pct(counts.B) },
    C: { count: counts.C, pct: pct(counts.C) },
    none_keep_scrolling: {
      count: counts.none_keep_scrolling,
      pct: pct(counts.none_keep_scrolling),
    },
  };

  const ranked: ("A" | "B" | "C")[] = ["A", "B", "C"].sort(
    (a, b) => counts[b as "A" | "B" | "C"] - counts[a as "A" | "B" | "C"],
  ) as ("A" | "B" | "C")[];
  const topKey = ranked[0];
  const topPct = clickShare[topKey].pct;
  const skipPct = clickShare.none_keep_scrolling.pct;

  let code: ExecutiveVerdictCode;
  if (skipPct >= 45 || topPct < 25) {
    code = "RETHINK";
  } else if (
    topPct >= 35 &&
    skipPct < 35 &&
    params.retentionSeverity !== "high"
  ) {
    code = "SHIP";
  } else {
    code = "ITERATE";
  }

  const winningOptionKey = skipPct >= 50 || counts[topKey] === 0 ? null : topKey;
  const winningTitle = winningOptionKey
    ? params.options.find((o) => o.optionKey === winningOptionKey)?.title ?? null
    : null;

  const isEs = params.language.toLowerCase().startsWith("es");
  const headline =
    code === "SHIP"
      ? isEs
        ? `LISTO PARA PUBLICAR — La Opción ${winningOptionKey} lidera con ${topPct}% de clics simulados (${skipPct}% seguiría de largo).`
        : `SHIP IT — Option ${winningOptionKey} leads with ${topPct}% simulated click share (${skipPct}% kept scrolling).`
      : code === "ITERATE"
        ? isEs
          ? `AJUSTAR ANTES DE LANZAR — ${winningOptionKey ? `La Opción ${winningOptionKey} va adelante (${topPct}%)` : "Empate débil"}, pero ${skipPct}% seguiría de largo o hay fricción en el gancho.`
          : `ITERATE BEFORE SHIPPING — ${winningOptionKey ? `Option ${winningOptionKey} leads (${topPct}%)` : "Weak split"}, with ${skipPct}% scroll-past risk or hook friction.`
        : isEs
          ? `REPLANTEAR CONCEPTO — ${skipPct}% de las Mentes seguiría de largo. Aplica el pivote editorial antes de invertir producción.`
          : `RETHINK PACKAGING — ${skipPct}% of Minds kept scrolling. Apply the editorial angle pivot before publishing.`;

  return { code, headline, winningOptionKey, winningTitle, clickShare };
}

export function compileReportPayload(params: {
  language: string;
  productionMode: ProductionMode;
  channelTitle: string;
  channelHandle: string | null;
  studyTitleDraft: string;
  diagnosticQuestions: DiagnosticQuestion[];
  options: Omit<ReportOptionSnapshot, "voteCount" | "voteSharePct">[];
  voices: ReportMindVoice[];
  strategist: StrategistOutput;
  warnings?: string[];
}): ReportPayload {
  const verdictCore = computeDeterministicVerdict({
    language: params.language,
    options: params.options.map((o) => ({
      optionKey: o.optionKey,
      title: o.title,
    })),
    votes: params.voices.map((v) => v.chosenOption),
    retentionSeverity: params.strategist.retention_cliff_diagnosis.severity,
  });

  const packagingMatrix: ReportOptionSnapshot[] = params.options.map((o) => ({
    ...o,
    voteCount: verdictCore.clickShare[o.optionKey].count,
    voteSharePct: verdictCore.clickShare[o.optionKey].pct,
  }));

  // Aggregate hesitation killers
  const killerCounts = new Map<string, number>();
  for (const v of params.voices) {
    const k = v.topHesitationKiller.trim();
    if (!k) continue;
    killerCounts.set(k, (killerCounts.get(k) || 0) + 1);
  }
  const topHesitationKillers = [...killerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([killer, count]) => ({ killer, count }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    language: params.language,
    productionMode: params.productionMode,
    channelTitle: params.channelTitle,
    channelHandle: params.channelHandle,
    studyTitleDraft: params.studyTitleDraft,
    totalMindsResponded: params.voices.length,
    totalSyntheticResponses:
      params.voices.length * params.diagnosticQuestions.length,
    verdict: {
      ...verdictCore,
      retentionCliff: params.strategist.retention_cliff_diagnosis,
      topHesitationKillers,
    },
    angleDiagnosis: {
      buriedAngles: params.strategist.buried_angles,
      preShootPlan: params.strategist.pre_shoot_plan,
      footageLockedPlan: params.strategist.footage_locked_plan,
    },
    packagingMatrix,
    diagnosticQuestions: params.diagnosticQuestions,
    voiceOfMinds: params.voices,
    warnings: params.warnings ?? [],
  };
}
