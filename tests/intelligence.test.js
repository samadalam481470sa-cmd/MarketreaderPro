import test from 'node:test';import assert from 'node:assert/strict';
import {parseFeed,PUBLIC_FEEDS,buildBriefing,localDate,ingestIntelligence} from '../apps/api/intelligence.js';
test('RSS parser extracts official link and timestamp',()=>{
 const xml='<rss><channel><item><title>Federal Reserve announcement</title><link>https://www.federalreserve.gov/newsevents/pressreleases/a.htm</link><guid>A-1</guid><pubDate>Fri, 30 Oct 2026 12:00:00 GMT</pubDate><description>Rates &amp; monetary policy</description></item></channel></rss>';
 const r=parseFeed(xml,PUBLIC_FEEDS[0]);assert.equal(r.length,1);assert.equal(r[0].summary,'Rates & monetary policy');assert.equal(r[0].category,'macro');
});
test('RSS parser rejects outbound hostile links',()=>{
 const xml='<rss><item><title>Bad</title><link>https://example.com/x</link><pubDate>Fri, 30 Oct 2026 12:00:00 GMT</pubDate></item></rss>';
 assert.equal(parseFeed(xml,PUBLIC_FEEDS[0]).length,0);
});
test('briefing clearly labels incomplete coverage',()=>{
 const b=buildBriefing({day:'2026-10-30',items:[],markets:[],filings:[],errors:{bls:'offline'}});assert.match(b.coverage,/No exhaustive/);assert.equal(b.warnings.length,1);
});
test('day conversion respects configured timezone',()=>assert.match(localDate(new Date('2026-10-30T12:00:00Z')),/2026/));
test('ingestion records partial failures and briefing',async()=>{
 const queries=[];
 const db={query:async(sql,params=[])=>{queries.push({sql,params});if(sql.startsWith('INSERT INTO intelligence_runs'))return {rows:[{id:7}]};return {rows:[],rowCount:1}}};
 const result=await ingestIntelligence(db,{fetcher:async()=>{throw Error('offline')},marketLoader:async()=>({availability:{kalshi:'rejected',polymarket:'rejected'},kalshi:[],polymarket:[],asOf:new Date().toISOString()})});
 assert.ok(result.errors.bls);assert.ok(result.errors.kalshi);assert.ok(queries.some(x=>x.sql.includes('INSERT INTO daily_briefings')));
});
