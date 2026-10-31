import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../apps/api/server.js';
let origin;
test.before(async()=>{
 if(!app.listening)await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+app.address().port;
});
test.after(()=>app.close());
function payload(){
 const dates=Array.from({length:50},(_,i)=>new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10));
 const make=(symbol,weight,rate)=>({
  symbol,weight,prices:dates.map((date,i)=>({date,close:100*(1+rate)**i}))
 });
 return {assets:[make('AAA',.55,.004),make('BBB',.45,-.002)],
  execution:{rebalanceEvery:5,driftThreshold:.01}};
}
async function post(body){
 return fetch(origin+'/api/portfolio-rebalance',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
 });
}
test('run allocation research without database, broker, or provider tokens',async()=>{
 const r=await post(payload());
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.mode,'historical-multi-asset-rebalance-simulation');
 assert.equal(data.simulation.portfolioDiversification.effectiveAssetsByConcentration>1,true);
 assert.equal(data.performance.chart.strategy.length,50);
 assert.ok(data.performance.strategy.finalEquity>0);
 assert.match(data.source,/User-uploaded/);
});
test('rejects missing assets and impossible allocation weights',async()=>{
 assert.equal((await post({})).status,422);
 const x=payload();x.assets[0].weight=.9;
 const r=await post(x);assert.equal(r.status,422);
 assert.match((await r.json()).error,/sum to 1/);
});
test('rejects GET and incompatible payload formats',async()=>{
 const wrong=await fetch(origin+'/api/portfolio-rebalance');
 assert.equal(wrong.status,405);
 const text=await fetch(origin+'/api/portfolio-rebalance',{method:'POST',body:'{}'});
 assert.equal(text.status,415);
});
test('dashboard JS module is actually served',async()=>{
 const r=await fetch(origin+'/portfolio-rebalance-ui.js');
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/javascript/);
 assert.match(await r.text(),/renderRebalance/);
 const html=await(await fetch(origin+'/')).text();
 assert.match(html,/id="portfolio-rebalance-form"/);
});
