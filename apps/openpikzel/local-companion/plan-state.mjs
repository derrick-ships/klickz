// Usage readings are intentionally memory-only. Never persist provider plan metadata.
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const percent=v=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(100,v)):undefined;
const reset=v=>{if(typeof v==='number'&&Number.isFinite(v)&&v>0)return v<1e12?v*1000:v;if(typeof v==='string'){const n=Date.parse(v);if(Number.isFinite(n))return n;}};
function window(value,kind,extra={}){const v=object(value),usedPercent=percent(v.usedPercent??v.utilization);if(usedPercent===undefined)return null;const resetsAt=reset(v.resetsAt??v.resets_at);return {kind,usedPercent,...(resetsAt?{resetsAt}:{}),...extra};}
export function codexWindows(response){
 const root=object(response),buckets=object(root.rateLimitsByLimitId),sources=Object.keys(buckets).length?Object.entries(buckets):[['default',object(root.rateLimits)]],result=[];
 for(const [bucket,limits]of sources)for(const slot of ['primary','secondary']){
  const v=object(object(limits)[slot]),duration=v.windowDurationMins;
  if(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0)continue;
  const kind=duration<=1440?'session':duration<=10080?'weekly':'monthly';
  const w=window(v,kind,{bucket});if(w)result.push(w);
 }return result;
}
export function claudeWindows(report){
 const r=object(object(report).rate_limits),out=[];
 for(const [key,kind]of [['five_hour','session'],['seven_day','weekly'],['monthly','monthly']]){const w=window(r[key],kind);if(w)out.push(w);}
 for(const v of Array.isArray(r.limits)?r.limits:[]){const value=object(v),name=String(value.kind||''),kind=value.scope?.model?'model':/week|seven.day/i.test(name)?'weekly':/month/i.test(name)?'monthly':/session|five.hour/i.test(name)?'session':null;if(!kind)continue;const w=window({usedPercent:value.percent,resets_at:value.resets_at},kind,value.scope?.model?{model:value.scope.model.display_name}:{});if(w)out.push(w);}
 const scoped=object(r.model_scoped);
 for(const [model,value]of Object.entries(scoped)){const w=window(value,'model',{model});if(w)out.push(w);}
 for(const [key,value]of Object.entries(r))if(key.startsWith('seven_day_')&&!Object.keys(scoped).length){const w=window(value,'model',{model:key.slice(10)});if(w)out.push(w);}
 return out;
}
export class PlanState{
 constructor(now=Date.now){this.now=now;this.readings=new Map();this.latches=new Map();this.refusals=new Map();}
 record(provider,windows,models){
  const now=this.now(),old=this.readings.get(provider)||{};
  // Missing/empty reports never erase a known exhaustion latch or pretend to be fresh.
  const next={...old,...(windows?.length?{windows,capturedAt:now}:{}),...(Array.isArray(models)?{models,modelsAt:now}:{})};this.readings.set(provider,next);
  for(const w of windows||[])if(w.usedPercent>=100){
   const id=provider+':'+w.kind+':'+(w.model||'')+':'+(w.bucket||'');
   this.latches.set(id,{provider,model:w.model,until:w.resetsAt>now?w.resetsAt:now+1800000});
  }
  return this.view(provider);
 }
 gate(provider,model){
  const now=this.now();let until=0;
  for(const [id,latch]of this.latches){if(latch.until<=now)this.latches.delete(id);else if(latch.provider===provider&&(!latch.model||latch.model===model))until=Math.max(until,latch.until);}
  return until?{allowed:false,retryAt:until}:{allowed:true};
 }
 refuse(provider,model,{actualRun=false}={}){
  if(actualRun&&model&&(this.readings.get(provider)?.models||[]).some(x=>x.id===model))this.refusals.set(provider+':'+model,this.now()+21600000);
 }
 view(provider){
  const r=this.readings.get(provider)||{},now=this.now();
  return {windows:r.windows||[],models:(r.models||[]).filter(m=>(this.refusals.get(provider+':'+m.id)||0)<=now),capturedAt:r.capturedAt??null,ageMs:r.capturedAt===undefined?null:now-r.capturedAt,stale:r.capturedAt===undefined||now-r.capturedAt>300000,gate:this.gate(provider)};
 }
}
