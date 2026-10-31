import test from 'node:test';
import assert from 'node:assert/strict';
import {planSourceIncidents,listSourceIncidents} from '../apps/api/quality-alerts.js';
test('critical source opens incident and only healthy sources are resolved',()=>{
 const report={sources:[
  {name:'official-bls',state:'healthy'},
  {name:'market-kalshi',state:'critical',reasons:['unavailable_last_attempt'],
   lastAttemptAt:'2026-10-31T00:00:00Z',consecutiveNonSuccesses:3}
 ],counts:{healthy:1,critical:1}};
 const planned=planSourceIncidents(report);
 assert.deepEqual(planned.resolve,['official-bls']);
 assert.equal(planned.openOrUpdate[0].sourceName,'market-kalshi');
 assert.equal(planned.counts.unhealthy,1);
});
test('sources missing from an ingestion do not count as recovered',()=>{
 const plan=planSourceIncidents({sources:[],counts:{}});
 assert.deepEqual(plan.resolve,[]);
 assert.deepEqual(plan.openOrUpdate,[]);
});
test('incident history query limits results using bound SQL parameters',async()=>{
 const queries=[];
 const db={query:async(sql,args)=>{queries.push({sql,args});return {rows:[
  {id:1,source_name:'market-kalshi',resolved_at:null}
 ]}}};
 const result=await listSourceIncidents(db,{limit:10,includeResolved:true});
 assert.equal(result.open,1);
 assert.deepEqual(queries[0].args,[10,true]);
 assert.match(queries[0].sql,/resolved_at IS NULL/);
 await assert.rejects(()=>listSourceIncidents(db,{limit:101}),/Incident limit/);
});
