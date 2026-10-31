import {loadSourceHealth} from './quality-monitor.js';

/**
 * Maintains one active incident per persisted source. A fresh healthy check
 * resolves an incident; a stale clock with no ingestion keeps it open.
 * PostgreSQL partial unique index prevents duplicate active alerts.
 */
export function planSourceIncidents(report){
 const unhealthy=report.sources.filter(s=>s.state!=='healthy');
 const active=unhealthy.map(s=>({
  sourceName:s.name,state:s.state,
  reasons:s.reasons,
  checkedAt:s.lastAttemptAt,
  lastSuccessAt:s.lastSuccessAt,
  failureStreak:s.consecutiveNonSuccesses,
  recentWeightedSuccessRate:s.recentWeightedSuccessRate
 }));
 const healthy=report.sources.filter(s=>s.state==='healthy').map(s=>s.name);
 return {
  openOrUpdate:active,
  resolve:healthy,
  currentSummary:report.counts,
  counts:{unhealthy:active.length,healthy:healthy.length}
 };
}
export async function refreshSourceIncidents(db,{now=Date.now()}={}){
 const report=await loadSourceHealth(db,{now});
 const plan=planSourceIncidents(report);
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  for(const incident of plan.openOrUpdate){
   await client.query(`
    INSERT INTO source_health_alerts
      (source_name,state,opened_at,last_seen_at,observations,reasons,details)
    VALUES($1,$2,now(),now(),1,$3,$4)
    ON CONFLICT(source_name) WHERE resolved_at IS NULL
    DO UPDATE SET state=EXCLUDED.state,
      last_seen_at=now(),observations=source_health_alerts.observations+1,
      reasons=EXCLUDED.reasons,details=EXCLUDED.details
   `,[incident.sourceName,incident.state,incident.reasons,
    JSON.stringify({checkedAt:incident.checkedAt,
     lastSuccessAt:incident.lastSuccessAt,
     failureStreak:incident.failureStreak,
     recentWeightedSuccessRate:incident.recentWeightedSuccessRate})]);
  }
  // Only sources that have affirmatively recovered are resolved.
  // A source disappearing from coverage is NOT treated as recovered.
  for(const name of plan.resolve){
   await client.query(`UPDATE source_health_alerts
    SET resolved_at=now(),last_seen_at=now()
    WHERE source_name=$1 AND resolved_at IS NULL`,[name]);
  }
  await client.query('COMMIT');
  return {checkedAt:report.checkedAt,openedOrUpdated:plan.openOrUpdate.length,
   healthySources:plan.resolve.length,overall:report.overall};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
export async function listSourceIncidents(db,{limit=30,includeResolved=false}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)
  throw Object.assign(Error('Incident limit must be 1–100'),{status:422});
 const r=await db.query(`SELECT id,source_name,state,opened_at,last_seen_at,
  resolved_at,observations,reasons,details
 FROM source_health_alerts
 WHERE ($2::boolean OR resolved_at IS NULL)
 ORDER BY opened_at DESC,id DESC LIMIT $1`,[limit,includeResolved]);
 return {
  alerts:r.rows,
  open:r.rows.filter(x=>x.resolved_at===null).length,
  shown:r.rows.length,
  includeResolved,
  note:'Operational collection health is not verification of published financial data or investment advice.'
 };
}
