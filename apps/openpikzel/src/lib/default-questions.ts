import type { DiagnosticQuestion } from "./schemas/study";

const EN_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "q_click_vote",
    category: "click_vote",
    prompt:
      "Scrolling your real YouTube feed right now, which packaging option (A, B, or C) actually stops your thumb — or would you keep scrolling?",
    locked: true,
  },
  {
    id: "q_clarity",
    category: "clarity",
    prompt:
      "In 1 second at phone size, what do you think this video is actually about — and is anything visually confusing?",
  },
  {
    id: "q_believability",
    category: "believability",
    prompt:
      "Does the thumbnail + title feel credible and earned, or does it trigger clickbait skepticism?",
  },
  {
    id: "q_relevance",
    category: "relevance",
    prompt:
      "Why would you click this today instead of ignoring it or telling yourself 'maybe later'?",
  },
  {
    id: "q_hook_alignment",
    category: "hook_alignment",
    prompt:
      "After reading the opening 60 seconds, does the video immediately pay off the promise of the thumbnail and title?",
  },
  {
    id: "q_hesitation",
    category: "hesitation",
    prompt:
      "What is the single biggest hesitation or doubt that almost stopped you from clicking?",
  },
  {
    id: "q_comment_objection",
    category: "comment_objection",
    prompt:
      "What blunt or skeptical top comment would you expect (or write yourself) under this video?",
  },
  {
    id: "q_shareability",
    category: "shareability",
    prompt:
      "Where in the first minute might you click off, and would you actually share this with a friend?",
  },
];

const ES_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "q_click_vote",
    category: "click_vote",
    prompt:
      "Haciendo scroll real en tu feed de YouTube ahora mismo, ¿qué opción (A, B o C) te haría frenar y dar clic — o seguirías de largo?",
    locked: true,
  },
  {
    id: "q_clarity",
    category: "clarity",
    prompt:
      "En 1 segundo en el celular, ¿de qué crees que trata exactamente el video y hay algo visualmente confuso?",
  },
  {
    id: "q_believability",
    category: "believability",
    prompt:
      "¿La miniatura y el título se sienten creíbles o disparan alarma de clickbait / exageración?",
  },
  {
    id: "q_relevance",
    category: "relevance",
    prompt:
      "¿Por qué verías este video hoy mismo en lugar de ignorarlo o dejarlo para después?",
  },
  {
    id: "q_hook_alignment",
    category: "hook_alignment",
    prompt:
      "Al leer los primeros 60 segundos del guion, ¿el video cumple de inmediato la promesa del título y la miniatura?",
  },
  {
    id: "q_hesitation",
    category: "hesitation",
    prompt:
      "¿Cuál es la mayor duda o fricción que casi te impidió hacer clic?",
  },
  {
    id: "q_comment_objection",
    category: "comment_objection",
    prompt:
      "¿Qué comentario escéptico o crítico esperarías ver con más likes debajo de este video?",
  },
  {
    id: "q_shareability",
    category: "shareability",
    prompt:
      "¿En qué momento del primer minuto podrías abandonar el video y lo compartirías con alguien?",
  },
];

export function defaultDiagnosticQuestions(language = "en"): DiagnosticQuestion[] {
  const base = language.toLowerCase().startsWith("es")
    ? ES_QUESTIONS
    : EN_QUESTIONS;
  return base.map((q) => ({ ...q }));
}
