import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySource,summarizeHealth,recordSourceChecks} from '../apps/api/quality-monitor.js';
const now=Date.parse('2026-10-31T12:00:00Z');
const iso=h=>new Date(now-h*3600000).toISOString();
const record=(state='ok',h=1)=>({
 source_name:'market-kalshi',last_status:state,last_attempt_at:iso(h),
 last_success_at:state==='ok'?iso(h):iso(1),item_count:5,
 history:[{status:state,checked_at:iso(h)}]
});
test('healthy status needs fresh observations and a successful last attempt',()=>{
 const health=classifySource(record(),{now});
 assert.equal(health.state,'healthy');
 assert.equal(health.recentWeightedSuccessRate,1);
});
test('a once-successful source is flagged stale after long silence',()=>{
 const health=classifySource(record('ok',72),{now});
 assert.equal(health.state,'stale');
 assert.ok(health.reasons.includes('stale_last_attempt'));
});
test('unavailable upstream and repeated failures are not hidden',()=>{
 const x=record('unavailable');
 x.history=Array.from({length:10},()=>({status:'unavailable'}));
 const h=classifySource(x,{now});
 assert.equal(h.state,'critical');
 assert.equal(h.consecutiveNonSuccesses,10);
 assert.ok(h.reasons.includes('elevated_failure_rate'));
});
test('a partial feed degrades overall source health',()=>{
 const a=record('partial');
 const summary=summarizeHealth([a],{now});
 assert.equal(summary.overall,'degraded');
 assert.equal(summary.counts.degraded,1);
});
test('no registered source is not reported as healthy',()=>{
 assert.equal(summarizeHealth([],{now}).overall,'unconfigured');
});
test('records only known status values with bounded counts and parameterized SQL',async()=>{
 const calls=[];
 const db={query:async(sql,values)=>{calls.push({sql,values});return {rowCount:1}}};
 const output=await recordSourceChecks(db,[
  {name:'market-kalshi',status:'ok',items:10},
  {name:'gdelt-foo',status:'partial',items:3},
  {name:'bad-source',status:'not-a-real-status',items:-1}
 ],{now:new Date(now)});
 assert.equal(output.length,3);
 assert.deepEqual(calls.map(x=>x.values[2]),['ok','partial','unavailable']);
 assert.equal(calls[2].values[3],0);
 assert.ok(calls.every(x=>x.sql.includes('$1')&&x.sql.includes('$5')));
});
