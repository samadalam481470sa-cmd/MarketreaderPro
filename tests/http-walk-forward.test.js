import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../apps/api/server.js';
let origin;
test.before(async()=>{
 if(!app.listening)await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+app.address().port;
});
test.after(()=>app.close());
const input=()=>({
 assets:[
  {symbol:'AAA',weight:.5,prices:Array.from({length:130},(_,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),close:100+i*.3}))},
  {symbol:'BBB',weight:.5,prices:Array.from({length:130},(_,i)=>({date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),close:70+i*.1}))}
 ],
 walkForward:{trainingBars:50,testingBars:35,stepBars:35,purgeGapBars:2}
});
const post=body=>fetch(origin+'/api/walk-forward',{
 method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
});
test('walk-forward HTTP returns only historical results',async()=>{
 const r=await post(input());
 assert.equal(r.status,200);
 const b=await r.json();
 assert.equal(b.mode,'historical-out-of-sample-walk-forward');
 assert.ok(b.folds.length>=1);
 assert.equal(b.methods.length,3);
});
test('impossible training windows return clear 422',async()=>{
 const v=input();v.walkForward.testingBars=100;
 const r=await post(v);
 assert.equal(r.status,422);
 assert.match((await r.json()).error,/Not enough|Testing bars/);
});
test('blocks GET and non-JSON writes',async()=>{
 assert.equal((await fetch(origin+'/api/walk-forward')).status,405);
 assert.equal((await fetch(origin+'/api/walk-forward',{method:'POST',body:'{}'})).status,415);
});
test('dashboard module and section are reachable',async()=>{
 const r=await fetch(origin+'/walk-forward-ui.js');
 assert.equal(r.status,200);
 assert.match(r.headers.get('content-type'),/javascript/);
 const html=await(await fetch(origin+'/')).text();
 assert.match(html,/id="walk-forward-form"/);
});
