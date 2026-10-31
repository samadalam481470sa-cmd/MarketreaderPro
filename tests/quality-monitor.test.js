import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySource,summarizeHealth,recordSourceChecks} from '../apps/api/quality-monitor.js';
const now=Date.parse('2026-10-31T12:00:00Z');
const at=h=>new Date(now-h*3600000).toISOString();
const entry=(status='ok',age=1)=>({
 source_name:'official-bls',last_status:status,last_attempt_at:at(age),
 last_success_at:status==='ok'?at(age):at(2),item_count:5,
 history:[{status,checked_at:at(age)}]
});
test('fresh successful feed is healthy',()=>{
 const report=classifySource(entry(),{now});
 assert.equal(report.state,'healthy');
 assert.equal(report.recentWeightedSuccessRate,1);
});
test('last success is not evidence of current freshness',()=>{
 const report=classifySource(entry('ok',96),{now});
 assert.equal(report.state,'stale');
 assert.ok(report.reasons.includes('stale_last_attempt'));
});
test('repeated outages are critical, not silently counted as success',()=>{
 const data=entry('unavailable',1);
 data.history=Array.from({length:10},()=>({status:'unavailable'}));
 const report=classifySource(data,{now});
 assert.equal(report.state,'critical');
 assert.equal(report.consecutiveNonSuccesses,10);
});
test('partial source means degraded overall reliability',()=>{
 const result=summarizeHealth([entry('partial')],{now});
 assert.equal(result.overall,'degraded');
 assert.equal(result.counts.degraded,1);
});
test('zero recorded attempts are explicitly unconfigured',()=>{
 assert.equal(summarizeHealth([],{now}).overall,'unconfigured');
});
test('quality events are parameterized and sanitize missing status',async()=>{
 const calls=[];
 const db={query:async(sql,values)=>{calls.push({sql,values});return {rowCount:1}}};
 const status=await recordSourceChecks(db,[
  {name:'market-kalshi',status:'ok',items:10},
  {name:'market-polymarket',status:'partial',items:3},
  {name:'source-error',status:'unknown',items:-1}
 ],{now:new Date(now)});
 assert.equal(status.length,3);
 assert.deepEqual(calls.map(x=>x.values[2]),['ok','partial','unavailable']);
 assert.equal(calls[2].values[3],0);
 assert.ok(calls.every(x=>x.sql.includes('$1')&&x.sql.includes('$5')));
});
