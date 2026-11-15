"use client";
import {WorkStatus,useElapsed} from "@/components/creative/work-status";
import type {WorkStage} from "@/lib/ui-spinner-verbs";
const stageOf=(label:string):WorkStage=>/scor|analy|review/i.test(label)?"score":/plan|prompt|draft/i.test(label)?"plan":"draw";
/** Any other running operation: the concrete label for screen readers, Pik and a verb on screen. */
export function OperationProgress({label}:{label:string}){
 const elapsed=useElapsed(label,true);
 return <section className="operation-progress" aria-label="Working">
  <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{label}</p>
  <WorkStatus stage={elapsed>90_000?"idle":stageOf(label)} elapsedMs={elapsed} detail={label}/>
  <span className="operation-track" aria-hidden="true"/>
 </section>;
}
