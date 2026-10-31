import test from 'node:test';
import assert from 'node:assert/strict';
import {createLimiter} from '../apps/api/security.js';
import {loadMarkets} from '../apps/api/markets.js';
test('rate limit resets after window',()=>{const l=createLimiter({limit:2,windowMs:1000});assert.equal(l.allow('a',0).allowed,true);assert.equal(l.allow('a',1).allowed,true);assert.equal(l.allow('a',2).allowed,false);assert.equal(l.allow('a',1000).allowed,true)});
test('separate IP buckets',()=>{const l=createLimiter({limit:1});assert.equal(l.allow('a').allowed,true);assert.equal(l.allow('b').allowed,true);assert.equal(l.allow('a').allowed,false)});
test('market sources fail independently',async()=>{const fake=async url=>{if(url.includes('kalshi'))throw Error('offline');return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify([{id:'1',question:'Sample market',outcomePrices:'[0.5,0.5]'}])}};const result=await loadMarkets({fetcher:fake});assert.equal(result.availability.kalshi,'rejected');assert.equal(result.availability.polymarket,'fulfilled');assert.equal(result.polymarket[0].title,'Sample market')});
test('market source strips unexpected properties',async()=>{const fake=async url=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(url.includes('kalshi')?{markets:[{ticker:'ABC',title:'Title',yes_ask:3,secret:'token'}]}:[])});const d=await loadMarkets({fetcher:fake});assert.equal(d.kalshi[0].secret,undefined)});
