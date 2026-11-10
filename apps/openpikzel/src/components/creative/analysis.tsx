"use client";
import {useState} from 'react';
import {Copy,WandSparkles,ChevronDown} from 'lucide-react';
import {pillars,type Evaluation} from '@/lib/types';
import {ScoreAnnouncer,ScoreNumber,useScoreReveal} from '@/components/creative/score-count';
const names={virality:'Virality',clarity:'Clarity',idea:'Idea',curiosity:'Curiosity',emotion:'Emotion'};
export function AnalysisPanel({score,busy,onFix,readOnly=false,resultKey=null,arrived=false}:{score:Evaluation;busy:boolean;onFix:()=>void;readOnly?:boolean;resultKey?:string|null;arrived?:boolean}){
 // OP-11: a result that arrived this session counts up here first and is announced in this dialog's
 // own live region (the page behind a modal dialog is inert). Otherwise the number stays still.
 const reveal=useScoreReveal(resultKey,score.overall,{arrived});
 const [copied,setCopied]=useState(false),fixes=pillars.map(p=>score.dimensions[p].fix).filter(Boolean);
 const prompt='Edit the attached thumbnail while preserving the person’s identity, factual video promise and exact wording unless I request otherwise. Assessed video title: '+score.title+'. Apply these evidence-based packaging suggestions:\n'+fixes.map((f,i)=>(i+1)+'. '+f).join('\n')+'\nKeep the original intact and create a new version. Do not invent a CTR or performance claim.';
 return <section className="analysis-overlay">
 <ScoreAnnouncer text={reveal.announce}/>
 <div className="analysis-overview"><div className="score-ring" role="img" aria-label={score.overall===null?'Partial assessment':score.overall+' out of100'}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/>{score.overall!==null&&<circle cx="60" cy="60" r="50" strokeDasharray={score.overall/100*314.16+' 314.16'}/>}</svg><strong>{score.overall===null?'Partial':<ScoreNumber reveal={reveal} final={score.overall}/>}{score.overall!==null&&<small>/100</small>}</strong></div><div><h3>OpenPikzels Score</h3><p>Image + title across five creative pillars.</p><small>{score.title||'No title supplied · context may be incomplete'}</small></div></div>
 {pillars.map(p=>{const d=score.dimensions[p],segments=d.score===null?0:Math.round(d.score/10);return <details key={p} className="analysis-more" name="analysis-pillar"><summary><span>{names[p]}</span><strong>{d.score??'Not assessed'}</strong><span className="analysis-more-label">More <ChevronDown size={13}/></span></summary><div className="pillar-segments" data-band={d.score===null?"unknown":d.score>=70?"strong":d.score>=45?"mixed":"weak"} aria-hidden="true">{Array.from({length:10},(_,i)=><i key={i} className={i<segments?'filled':''}/>)}</div><p>{d.missingReason||d.observation}</p><dl><dt>Working for you</dt><dd>{d.strength||'No supporting observation returned.'}</dd><dt>Holding it back</dt><dd>{d.weakness||'No specific weakness assessed.'}</dd><dt>What to change</dt><dd>{d.fix||'No specific recommendation is supported by the available evidence.'}</dd></dl><small>Confidence: {d.confidence>=.7?'high':d.confidence>=.3?'medium':'low'} · AI assessment</small></details>;})}
 {score.contributors?.length ? <ul className="analysis-contributors" aria-label="Analysis contributors">{score.contributors.map(c=><li key={c.role}>{c.provider} · {c.model} · {c.role==="scoring"?"Five-pillar scoring":"Image-specific guidance"}</li>)}</ul> : <p>Provider details were not recorded for this older assessment.</p>}
 {score.warnings?.length ? <ul className="analysis-evidence-notes">{score.warnings.map(w=><li key={w}>{w}</li>)}</ul> : null}
 <p className="score-disclaimer">{score.note} This is a creative assessment, not measured YouTube performance.</p>
 {!readOnly&&<div className="consent-actions"><button className="neutral-button" disabled={!fixes.length} onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setCopied(true);}catch{setCopied(false);}}}><Copy size={15}/>{copied?'Prompt copied':'Copy improvement prompt'}</button><button className="primary-button" disabled={busy||score.fixBlocked} onClick={onFix}><WandSparkles size={15}/>One-click fix</button></div>}
 </section>;
}
