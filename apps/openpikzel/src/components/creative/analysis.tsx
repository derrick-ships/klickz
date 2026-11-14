"use client";
import {useState} from 'react';
import {Copy,WandSparkles,ChevronDown} from 'lucide-react';
import {pillars,type Evaluation} from '@/lib/types';
import {ScoreAnnouncer,ScoreNumber,useScoreReveal} from '@/components/creative/score-count';
import {fixPrompt} from '@/lib/fix-prompt';
const names={virality:'Virality',clarity:'Clarity',idea:'Idea',curiosity:'Curiosity',emotion:'Emotion'};
export function AnalysisPanel({score,busy,onFix,onAdjust,fixUnavailable=false,readOnly=false,resultKey=null,arrived=false}:{score:Evaluation;busy:boolean;onFix:()=>void;onAdjust?:()=>void;fixUnavailable?:boolean;readOnly?:boolean;resultKey?:string|null;arrived?:boolean}){
 // OP-11: a result that arrived this session counts up here first and is announced in this dialog's
 // own live region (the page behind a modal dialog is inert). Otherwise the number stays still.
 const reveal=useScoreReveal(resultKey,score.overall,{arrived});
 const [copied,setCopied]=useState(false);
 const prompt=fixPrompt(score)||'';
 return <section className="analysis-overlay">
 <ScoreAnnouncer text={reveal.announce}/>
 <div className="analysis-overview"><div className="score-ring" role="img" aria-label={score.overall===null?'Partial assessment':score.overall+' out of100'}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/>{score.overall!==null&&<circle cx="60" cy="60" r="50" strokeDasharray={score.overall/100*314.16+' 314.16'}/>}</svg><strong>{score.overall===null?'Partial':<ScoreNumber reveal={reveal} final={score.overall}/>}{score.overall!==null&&<small>/100</small>}</strong></div><div><h3>OpenPikzels Score</h3><p>Image + title across five creative pillars.</p><small>{score.title||'No title supplied · context may be incomplete'}</small></div></div>
 {pillars.map(p=>{const d=score.dimensions[p],segments=d.score===null?0:Math.round(d.score/10);return <details key={p} className="analysis-more" name="analysis-pillar"><summary><span>{names[p]}</span><strong>{d.score??'Not assessed'}</strong><span className="analysis-more-label">More <ChevronDown size={13}/></span></summary><div className="pillar-segments" data-band={d.score===null?"unknown":d.score>=70?"strong":d.score>=45?"mixed":"weak"} aria-hidden="true">{Array.from({length:10},(_,i)=><i key={i} className={i<segments?'filled':''}/>)}</div><p>{d.missingReason||d.observation}</p><dl><dt>Working for you</dt><dd>{d.strength||'No supporting observation returned.'}</dd><dt>Holding it back</dt><dd>{d.weakness||'No specific weakness assessed.'}</dd><dt>What to change</dt><dd>{d.fix||'No specific recommendation is supported by the available evidence.'}</dd></dl><small>Confidence: {d.confidence>=.7?'high':d.confidence>=.3?'medium':'low'} · AI assessment</small></details>;})}
 {score.contributors?.length ? <ul className="analysis-contributors" aria-label="Analysis contributors">{score.contributors.map(c=><li key={c.role}>{c.provider} · {c.model} · {c.role==="scoring"?"Five-pillar scoring":"Image-specific guidance"}</li>)}</ul> : <p>Provider details were not recorded for this older assessment.</p>}
 {score.warnings?.length ? <ul className="analysis-evidence-notes">{score.warnings.map(w=><li key={w}>{w}</li>)}</ul> : null}
 <p className="score-disclaimer">{score.note} This is a creative assessment, not measured YouTube performance.</p>
 {prompt&&<details className="analysis-more analysis-fix-prompt" open={!readOnly}><summary><span>One-click fix prompt</span><span className="analysis-more-label">Show <ChevronDown size={13}/></span></summary><p className="dialog-footnote">Ready now. Paste it with the original into any image editor, or use “Fix what's holding it back” to render a new version and re-score it.</p><pre className="fix-prompt-text">{prompt}</pre></details>}
 {!readOnly&&<div className="consent-actions"><button className="neutral-button" disabled={!prompt} onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setCopied(true);}catch{setCopied(false);}}}><Copy size={15}/>{copied?'Prompt copied':'Copy improvement prompt'}</button><button className="primary-button" disabled={busy||score.fixBlocked||fixUnavailable} onClick={onFix}><WandSparkles size={15}/>Fix what's holding it back</button>{onAdjust&&<a href="#adjust-fix" onClick={e=>{e.preventDefault();onAdjust();}}>Adjust fix first</a>}</div>}
 </section>;
}
