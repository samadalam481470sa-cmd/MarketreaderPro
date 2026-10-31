import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../apps/api/server.js';
let origin;
test.before(async()=>{
  if (!app.listening) await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+app.address().port;
});
test.after(()=>app.close());
function sampleBars(count=45){
  return Array.from({length:count},(_,i)=>{
    const price=80+i*.3;
    return {date:new Date(Date.UTC(2025,0,i+1)).toISOString(),
      open:price,high:price+2,low:price-2,close:price+1,volume:10000+i};
  });
}
function post(body){
  return fetch(origin+'/api/backtest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
test('backtesting endpoint accepts user-supplied historical prices',async()=>{
  const r=await post({bars:sampleBars(),options:{strategy:'buy-and-hold'},stress:false});
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.mode,'historical-simulation');
  assert.equal(data.observations,45);
  assert.equal(data.strategyResult.trades[0].index,1);
  assert.equal(data.benchmark.name,'next-open-buy-and-hold');
  assert.equal(data.stress,null);
  assert.match(data.source,/User-supplied/);
});
test('backtest rejects invalid bars with a clear 422',async()=>{
  const invalid=sampleBars();
  invalid[5].low=invalid[5].high+10;
  const r=await post({bars:invalid});
  assert.equal(r.status,422);
  assert.match((await r.json()).error,/OHLC/);
});
test('backtest rejects request without JSON content type',async()=>{
  const r=await fetch(origin+'/api/backtest',{method:'POST',body:'invalid'});
  assert.equal(r.status,415);
});
test('backtest rejects excessively long JSON',async()=>{
  const r=await post({bars:sampleBars(),padding:'x'.repeat(161000)});
  assert.equal(r.status,413);
});
test('backtest does not permit GET',async()=>{
  const r=await fetch(origin+'/api/backtest');
  assert.equal(r.status,405);
});
test('CSV file handler and dashboard are served by the running app',async()=>{
  for(const name of ['csv.js','backtest-ui.js']){
    const r=await fetch(origin+'/'+name);
    assert.equal(r.status,200,name);
    assert.match(r.headers.get('content-type'),/javascript/);
    assert.match(await r.text(),/export|import/);
  }
  const homepage=await(await fetch(origin+'/')).text();
  assert.match(homepage,/id="backtest-form"/);
  assert.match(homepage,/backtest-ui.js/);
});
