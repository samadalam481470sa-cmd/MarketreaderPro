import test from 'node:test';
import assert from 'node:assert/strict';
import {app} from '../apps/api/server.js';
const before=async()=>{if(!app.listening)await new Promise(r=>app.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+app.address().port};
test.after(()=>app.close());
test('health and readiness',async()=>{const url=await before();const [a,b]=await Promise.all([fetch(url+'/api/health'),fetch(url+'/api/ready')]);assert.equal(a.status,200);assert.equal((await a.json()).mode,'research-only');assert.equal((await b.json()).ready,true);assert.equal(a.headers.get('x-content-type-options'),'nosniff')});
test('invalid JSON and content-type rejected',async()=>{const url=await before();const a=await fetch(url+'/api/risk',{method:'POST',headers:{'content-type':'text/plain'},body:'hello'});assert.equal(a.status,415);const b=await fetch(url+'/api/risk',{method:'POST',headers:{'content-type':'application/json'},body:'no'});assert.equal(b.status,400)});
test('oversized body rejected',async()=>{const url=await before();const a=await fetch(url+'/api/research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:'x'.repeat(9000)})});assert.equal(a.status,413)});
test('static asset and unlisted files',async()=>{const url=await before();const a=await fetch(url+'/dashboard-preview.svg');assert.equal(a.status,200);assert.match(a.headers.get('content-type'),/svg/);const b=await fetch(url+'/package.json');assert.equal(b.status,404)});
test('risk math endpoint',async()=>{const url=await before();const a=await fetch(url+'/api/risk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({positions:[{symbol:'A',value:60},{symbol:'B',value:40}]})});assert.equal(a.status,200);assert.equal((await a.json()).herfindahl,.52)});

test('new README illustration assets are served correctly',async()=>{const url=await before();for(const name of ['intelligence-dashboard.svg','government-dashboard.svg']){const r=await fetch(url+'/'+name);assert.equal(r.status,200,name);assert.match(r.headers.get('content-type'),/image\/svg\+xml/);assert.match(await r.text(),/<svg /)}});
