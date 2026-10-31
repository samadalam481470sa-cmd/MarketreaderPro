/**
 * Source-health reports use actual persisted attempts, not marketing targets.
 * A source can be "ok" at its last check and still be stale now.
 */
export function classifySource(record,{now=Date.now(),maxAgeHours=36,window=20}={}){
 const status=record?.last_status;
 const parsed=Date.parse(record?.last_attempt_at);
 const success=record?.last_success_at?Date.parse(record.last_success_at):NaN;
 const attempts=(record?.history||[]).slice(0,window);
 const ok=attempts.filter(x=>x.status==='ok').length;
 const partial=attempts.filter(x=>x.status==='partial').length;
 const failed=attempts.filter(x=>x.status==='unavailable').length;
 let streak=0;
 for(const x of attempts){if(x.status==='ok')break;streak++}
 const ageHours=Number.isFinite(parsed)?Math.max(0,(now-parsed)/3600000):null;
 const successAgeHours=Number.isFinite(success)?Math.max(0,(now-success)/3600000):null;
 const statusRate=attempts.length?(ok+partial*.5)/attempts.length:null;
 const reasons=[];
 if(!Number.isFinite(parsed))reasons.push('no_collection_timestamp');
 if(ageHours!==null&&ageHours>maxAgeHours)reasons.push('stale_last_attempt');
 if(!Number.isFinite(success))reasons.push('never_succeeded');
 if(successAgeHours!==null&&successAgeHours>maxAgeHours)reasons.push('stale_last_success');
 if(status==='partial')reasons.push('partial_last_attempt');
 if(status==='unavailable')reasons.push('unavailable_last_attempt');
 if(attempts.length>=5&&failed/attempts.length>.2)reasons.push('elevated_failure_rate');
 const state=ageHours===null?'unknown':ageHours>maxAgeHours?'stale':
  status==='unavailable'||streak>=3?'critical':
  status==='partial'||reasons.some(x=>x==='never_succeeded'||x==='elevated_failure_rate'||x==='stale_last_success')?'degraded':'healthy';
 return {
  name:record.source_name,state,reasons,
  lastStatus:status,lastAttemptAt:record.last_attempt_at,
  lastSuccessAt:record.last_success_at??null,
  lastItemCount:record.item_count??0,
  ageHours,successAgeHours,
  recentSampleCount:attempts.length,
  recentSuccessCount:ok,recentPartialCount:partial,recentUnavailableCount:failed,
  recentWeightedSuccessRate:statusRate,
  consecutiveNonSuccesses:streak,
  freshnessThresholdHours:maxAgeHours
 };
}
export function summarizeHealth(records,{now=Date.now(),maxAgeHours=36}={}){
 const sources=records.map(x=>classifySource(x,{now,maxAgeHours}));
 const counts={healthy:0,degraded:0,critical:0,stale:0,unknown:0};
 for(const s of sources)counts[s.state]++;
 const overall=!sources.length?'unconfigured':
  counts.critical?'critical':counts.stale?'stale':counts.degraded||counts.unknown?'degraded':'healthy';
 return {
  overall,checkedAt:new Date(now).toISOString(),
  counts,totalSources:sources.length,
  sources,
  warnings:[
   'Last collection success is not proof that the underlying publisher data are complete or accurate.',
   'The 36-hour window is an operational default, not a source publication promise.',
   ...(!sources.length?['No registered source attempts yet. Run the intelligence collector.']:[])
  ]
 };
}
export async function recordSourceChecks(db,sources,{now=new Date()}={}){
 const events=[];
 for(const entry of sources){
  const sourceName=String(entry.name||'');
  if(sourceName.length<2||sourceName.length>150)continue;
  const status=['ok','partial','unavailable'].includes(entry.status)?entry.status:'unavailable';
  const count=Number.isSafeInteger(entry.items)&&entry.items>=0?entry.items:0;
  const reason=status==='ok'?null:status==='partial'?'partial_source_results':'source_unavailable';
  await db.query(`INSERT INTO source_health_events
   (source_name,checked_at,status,item_count,reason_code)
   VALUES($1,$2,$3,$4,$5)`,[sourceName,now,status,count,reason]);
  events.push({name:sourceName,status,items:count});
 }
 return events;
}
export async function loadSourceHealth(db,{now=Date.now(),maxAgeHours=36}={}){
 const [coverage,histories]=await Promise.all([
  db.query(`SELECT source_name,last_attempt_at,last_success_at,last_status,item_count
    FROM source_coverage ORDER BY source_name LIMIT 200`),
  db.query(`SELECT source_name,checked_at,status,item_count,reason_code FROM
    (SELECT source_name,checked_at,status,item_count,reason_code,
       row_number() OVER (PARTITION BY source_name ORDER BY checked_at DESC,id DESC) AS seq
     FROM source_health_events) ranked WHERE seq<=20
     ORDER BY source_name,checked_at DESC LIMIT 4000`)
 ]);
 const history=new Map();
 for(const row of histories.rows){
  if(!history.has(row.source_name))history.set(row.source_name,[]);
  history.get(row.source_name).push(row);
 }
 return summarizeHealth(coverage.rows.map(row=>({
  ...row,history:history.get(row.source_name)||[]
 })),{now,maxAgeHours});
}
