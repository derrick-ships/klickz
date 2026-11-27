import { Inngest, eventType, staticSchema } from "inngest";

export const channelIngestRequested = eventType("channel/ingest.requested", {
  schema: staticSchema<{
    runId: string;
    userId: string;
    channelInput: string;
    existingChannelId?: string;
  }>(),
});

export const studyTriangulateRequested = eventType(
  "study/triangulate.requested",
  {
    schema: staticSchema<{
      studyId: string;
      runId: string;
      userId: string;
    }>(),
  },
);

export const inngest = new Inngest({
  id: "openpikzels-preflight",
});
