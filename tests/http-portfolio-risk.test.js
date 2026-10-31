import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../apps/api/server.js';
let url;
test.before(async()=>{
  if(!app.listening)await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  url='http://127.0.0.1:'+app.address().port;
});
test.after(()=>app.close());
function portfolio(count=42){
  const d=i=>new Date(Date.UTC(2025,0,1+i)).toISOString();
  const make=(symbol,weight,base,mult)=>({
    symbol,weight,prices:Array.from({length:count},(_,i)=>
      ({date:d(i),close:base*(1+i*.0015+Math.sin(i/6)*mult)}))
  });
  return {assets:[make('AAA',.6,100,.02),make('BBB',.4,60,.015)],periodsPerYear:252,confidence:.95};
}
async function post(value){
  return fetch(url+'/api/portfolio-risk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
}
test('public research portfolio risk calculates source-unverified historical data',async()=>{
  const response=await post(portfolio());
  assert.equal(response.status,200);
  const report=await response.json();
  assert.equal(report.mode,'historical-user-data-only');
  assert.equal(report.symbols.length,2);
  assert.equal(report.historical.path.curve.length,42);
  assert.ok(report.historical.tailRisk.expectedShortfallFraction>=0);
  assert.ok(report.returns.annualizedPortfolioVolatility>=0);
  assert.equal(report.stressScenarios.length,3);
});
test('unmatched dates and dishonest weights rejected with HTTP 422',async()=>{
  const wrong=portfolio();wrong.assets[1].weight=.2;
  const response=await post(wrong);
  assert.equal(response.status,422);
  assert.match((await response.json()).error,/sum to 1/);
  const date=portfolio();
  date.assets[1].prices[25].date='2026-01-25';
  assert.equal((await post(date)).status,422);
});
test('endpoint refuses unexpected GET and non-JSON POST',async()=>{
  assert.equal((await fetch(url+'/api/portfolio-risk')).status,405);
  assert.equal((await fetch(url+'/api/portfolio-risk',{method:'POST',body:'no'})).status,415);
});
test('dashboard and parser files are actually served',async()=>{
  for(const name of ['portfolio-risk-ui.js','portfolio-csv.js']){
    const response=await fetch(url+'/'+name);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type'),/javascript/);
  }
  assert.match(await (await fetch(url+'/')).text(),/id="portfolio-risk-form"/);
});
