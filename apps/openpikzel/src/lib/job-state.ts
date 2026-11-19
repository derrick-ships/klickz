export function jobOperationLabel(operation: string) {
 return operation === "generate" ? "Create" : operation === "analyze" ? "Score" : "API request";
}
export const uncertainJobAdvice = "Check your provider's usage page before trying again. OpenPikzels never retries automatically.";
/** Read-only policy shared by people and agents. It never dispatches or retries. */
export const jobStates = ["queued","running","succeeded","failed","reconciling"] as const;
export type JobState = typeof jobStates[number];
const policies = {
 queued: {label:"Queued", nextAction:"wait", message:"This request is reserved. Wait and refresh Jobs; do not submit it again."},
 running: {label:"Running", nextAction:"wait", message:"The provider request is in progress. Wait and refresh Jobs; do not submit it again."},
 succeeded: {label:"Completed", nextAction:"use_result", message:"Open the saved result in My creations. Reuse the same request ID to retrieve a completed response."},
 failed: {label:"Failed", nextAction:"inspect_before_new_request", message:"Inspect Jobs, My creations and your provider history before deciding on a new request. A failed batch may contain saved images."},
 reconciling: {label:"Outcome uncertain", nextAction:"inspect_provider_history", message:"This request may have used provider credits. Check My creations and provider history before any new attempt."},
} as const;
export function jobGuidance(state: unknown) {
 const known = typeof state === "string" && Object.hasOwn(policies,state);
 const policy = known ? policies[state as JobState] : {label:"Unknown status",nextAction:"inspect_before_new_request",message:"Refresh Jobs and check provider history before attempting another request."};
 return {...policy,automaticRetryAllowed:false as const};
}
