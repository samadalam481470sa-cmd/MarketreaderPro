import test from 'node:test';
import assert from 'node:assert/strict';
import {planSourceIncidents,listSourceIncidents} from '../apps/api/quality-alerts.js';
test('unhealthy source produces an incident with measurable reasons',()=>{
 const report={sources:[
  {name:'official-bls',state:'healthy'},
  {name:'market-kalshi',state:'critical',reasons:['unavailable_last_attempt'],
   lastAttemptAt:'2026-10-31',lastSuccessAt:null,consecutiveNonSuccesses:3}
 ],counts:{healthy:1,critical:1}};
 const plan=planSourceIncidents(report);
 assert.equal(plan.counts.unhealthy,1);
 assert.deepEqual(plan.resolve,['official-bls']);
 assert.equal(plan.openOrUpdate[0].sourceName,'market-kalshi');
});
test('missing a source from the report never implies recovery',()=>{
 const plan=planSourceIncidents({sources:[],counts:{}});
 assert.equal(plan.resolve.length,0);
 assert.equal(plan.openOrUpdate.length,0);
});
test('incident history query is parameterized and respects optional resolved filter',async()=>{
 const calls=[];
 const db={query:async(sql,args)=>{
  calls.push({sql,args});
  return {rows:[{id:1,state:'critical',resolved_at:null}]};
 }};
 const r=await listSourceIncidents(db,{limit:20,includeResolved:true});
 assert.equal(r.open,1);
 assert.deepEqual(calls[0].args,[20,true]);
 assert.match(calls[0].sql,/resolved_at IS NULL/);
 assert.rejects(()=>listSourceIncidents(db,{limit:101}),/Incident limit/);
});
