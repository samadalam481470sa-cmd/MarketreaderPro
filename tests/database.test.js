import test from 'node:test';
import assert from 'node:assert/strict';
import {saveMarkets,readHistory} from '../apps/api/database.js';
test('database persistence uses parameterized market values',async()=>{
 const operations=[];
 const client={query:async(text,params=[])=>{
  operations.push({text,params});
  if(text.startsWith('INSERT INTO ingestion_runs'))return {rows:[{id:5}]};
  if(text.startsWith('INSERT INTO markets'))return {rows:[{id:10}]};
  return {rows:[]};
 },release(){}};
 const db={connect:async()=>client};
 assert.equal(await saveMarkets(db,'kalshi',[{id:"ABC' DROP TABLE markets;--",title:'Example',yesPrice:45}]),1);
 const insert=operations.find(o=>o.text.startsWith('INSERT INTO markets'));
 assert.match(insert.text,/\$1/);
 assert.equal(insert.params[1],"ABC' DROP TABLE markets;--");
 const observation=operations.find(o=>o.text.startsWith('INSERT INTO market_observations'));
 assert.equal(observation.params[2],0.45);
 assert.ok(operations.some(o=>o.text==='COMMIT'));
});
test('invalid batches are rejected',async()=>{await assert.rejects(saveMarkets({},'invalid',[]));await assert.rejects(saveMarkets({},'kalshi',Array(101).fill({})))});
test('history validates input before SQL',async()=>{await assert.rejects(readHistory({}, {source:'invalid',externalId:'x'}));await assert.rejects(readHistory({}, {source:'kalshi',externalId:'x',limit:900}))});
test('history filters by source and id',async()=>{const db={query:async(q,args)=>{assert.deepEqual(args,['kalshi','ABC',10]);return {rows:[{title:'A',probability:'0.51'}]}}};const r=await readHistory(db,{source:'kalshi',externalId:'ABC',limit:10});assert.equal(r.history.length,1)});
