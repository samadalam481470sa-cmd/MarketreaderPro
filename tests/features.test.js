import test from 'node:test';import assert from 'node:assert/strict';
import {hashPassword,verifyPassword,validatePaperOrder} from '../apps/api/accounts.js';
import {validateCik,fetchSecFilings} from '../apps/api/sec.js';
import {aiResearch} from '../apps/api/ai.js';
test('password hashes and verifies',async()=>{const h=await hashPassword('long-reasonable-password');assert.equal(await verifyPassword('long-reasonable-password',h),true);assert.equal(await verifyPassword('wrong-password',h),false);assert.notEqual(h,await hashPassword('long-reasonable-password'))});
test('rejects malformed orders and overflows',()=>{assert.throws(()=>validatePaperOrder({symbol:'AAPL',side:'buy',quantity:1,priceCents:100}));assert.throws(()=>validatePaperOrder({symbol:'ABC',side:'buy',quantity:100000,priceCents:100000000,requestId:'a'}))});
test('validates canonical CIK',()=>{assert.equal(validateCik('320193'),'0000320193');assert.throws(()=>validateCik('../abc'))});
test('parses SEC Form 4 metadata only',async()=>{const r=await fetchSecFilings('320193',{userAgent:'MarketreaderPro contact@example.com',fetcher:async()=>({ok:true,json:async()=>({filings:{recent:{form:['10-K','4'],accessionNumber:['0000320193-26-000001','0000320193-26-000002'],filingDate:['2026-01-01','2026-01-02'],primaryDocument:['a.htm','b.htm']}}})})});assert.equal(r.length,1);assert.match(r[0].sourceUrl,/000032019326000002/);assert.equal('amountMin' in r[0],false)});
test('rule-based AI fallback disclosed',async()=>{const x=await aiResearch('Explain ETFs',{env:{}});assert.equal(x.provider,'local-rules')});
