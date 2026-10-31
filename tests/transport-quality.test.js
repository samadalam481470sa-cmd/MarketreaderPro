import test from 'node:test';import assert from 'node:assert/strict';
import {readJson} from '../apps/api/security.js';
import {parseTimestamp} from '../apps/api/backtest/validation.js';
import {validatePortfolio} from '../apps/api/portfolio-risk/validation.js';
function request(chunks,headers={'content-type':'application/json'}){
 return {headers,async *[Symbol.asyncIterator](){for(const chunk of chunks)yield chunk;}};
}
test('JSON parses UTF-8 split across transport chunks without replacement characters',async()=>{
 const payload=Buffer.from(JSON.stringify({label:'💹 financial research'}),'utf8');
 const index=payload.indexOf(Buffer.from('💹'))+2;
 const decoded=await readJson(request([payload.subarray(0,index),payload.subarray(index)]));
 assert.equal(decoded.label,'💹 financial research');
});
test('malformed UTF-8 is rejected instead of silently corrupting input',async()=>{
 await assert.rejects(readJson(request([Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xc3,0x22,0x7d])])),e=>e.status===400);
});
test('announced oversized request is rejected before processing',async()=>{
 await assert.rejects(readJson(request([],{ 'content-type':'application/json','content-length':'999999' })),e=>e.status===413);
});
test('calendar days cannot silently normalize into a different month',()=>{
 assert.throws(()=>parseTimestamp('2025-02-31'),/Invalid calendar/);
 assert.equal(new Date(parseTimestamp('2025-02-28')).toISOString().slice(0,10),'2025-02-28');
 const start=Date.parse('2025-01-01T00:00:00Z');
 const valid=Array.from({length:35},(_,i)=>({date:new Date(start+i*86400000).toISOString().slice(0,10),close:100+i}));
 const other=valid.map(v=>({...v}));
 other[15].date='2025-02-31';
 assert.throws(()=>validatePortfolio({assets:[
  {symbol:'AAA',weight:0.5,prices:valid},
  {symbol:'BBB',weight:0.5,prices:other}
 ]}),/Invalid calendar|ordered|match/);
});
