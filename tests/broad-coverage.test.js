import test from 'node:test';import assert from 'node:assert/strict';
import {parseGdelt,discoverNews,NEWS_TOPICS} from '../apps/api/broad-news.js';
import {discoverMarketUniverse} from '../apps/api/market-universe.js';
import {coverageSummary} from '../apps/api/coverage.js';
test('GDELT parser checks source URL and timestamp',()=>{
 const data={articles:[{title:'Markets up',url:'https://example.org/article',seendate:'20261030090000'},{title:'bad',url:'javascript:alert(1)',seendate:'20261030090000'}]};
 const r=parseGdelt(data,NEWS_TOPICS[0]);assert.equal(r.length,1);assert.equal(r[0].category,'news');
});
test('GDELT per-topic failures remain isolated',async()=>{
 const result=await discoverNews({topics:NEWS_TOPICS.slice(0,2),fetcher:async url=>{
  if(String(url).includes('bitcoin'))throw Error('unavailable');
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({articles:[{title:'Market update',url:'https://example.org/1',seendate:'20261030080000'}]})};
 }});
 assert.equal(result.rows.length,1);assert.equal(Object.keys(result.errors).length,1);
});
test('paged markets deduplicate identifiers',async()=>{
 const result=await discoverMarketUniverse({pages:2,pageSize:2,fetcher:async url=>({
  ok:true,text:async()=>JSON.stringify(String(url).includes('kalshi')?{markets:[{ticker:'A',title:'Market A'}],cursor:null}:[{id:'1',question:'One',outcomePrices:'[]'}])
 })});assert.equal(result.rows.kalshi.length,1);assert.equal(result.rows.polymarket.length,1);
});
test('coverage does not overclaim',()=>assert.match(coverageSummary({}).scope,/NOT exhaustive/));
