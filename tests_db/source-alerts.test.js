import test from 'node:test';
import assert from 'node:assert/strict';
import {getPool,closePool} from '../apps/api/database.js';
import {recordSourceChecks} from '../apps/api/quality-monitor.js';
import {refreshSourceIncidents,listSourceIncidents} from '../apps/api/quality-alerts.js';
const source='ci-incident-transition';
let db;
test.before(async()=>{db=await getPool()});
test.after(async()=>{
 if(db){
  await db.query('DELETE FROM source_health_alerts WHERE source_name=$1',[source]);
  await db.query('DELETE FROM source_health_events WHERE source_name=$1',[source]);
  await db.query('DELETE FROM source_coverage WHERE source_name=$1',[source]);
 }
 await closePool();
});
async function coverage(status){
 await db.query(`INSERT INTO source_coverage
  (source_name,last_attempt_at,last_success_at,last_status,item_count)
  VALUES($1,now(),CASE WHEN $2='ok' THEN now() ELSE NULL END,$2,4)
  ON CONFLICT(source_name) DO UPDATE SET
   last_attempt_at=now(),last_status=$2,
   last_success_at=CASE WHEN $2='ok' THEN now() ELSE source_coverage.last_success_at END,
   item_count=4`,[source,status]);
 await recordSourceChecks(db,[{name:source,status,items:4}]);
}
test('unavailable collection opens exactly one active alert',async()=>{
 await coverage('unavailable');
 await refreshSourceIncidents(db);
 await refreshSourceIncidents(db);
 const r=await db.query('SELECT * FROM source_health_alerts WHERE source_name=$1 AND resolved_at IS NULL',[source]);
 assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].state,'critical');
 assert.ok(r.rows[0].observations>=2);
});
test('fresh successful collection resolves alert while retaining history',async()=>{
 await coverage('ok');
 await refreshSourceIncidents(db);
 const r=await db.query('SELECT * FROM source_health_alerts WHERE source_name=$1',[source]);
 assert.equal(r.rows.length,1);
 assert.ok(r.rows[0].resolved_at);
 const report=await listSourceIncidents(db,{includeResolved:true});
 assert.ok(report.alerts.some(x=>x.source_name===source && x.resolved_at));
});
test('later outage opens a new incident, preserves resolved incident',async()=>{
 await coverage('unavailable');
 await refreshSourceIncidents(db);
 const r=await db.query('SELECT * FROM source_health_alerts WHERE source_name=$1 ORDER BY id',[source]);
 assert.equal(r.rows.length,2);
 assert.ok(r.rows[0].resolved_at);
 assert.equal(r.rows[1].resolved_at,null);
});
