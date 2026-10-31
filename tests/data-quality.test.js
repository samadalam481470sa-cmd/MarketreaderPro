import test from 'node:test';import assert from 'node:assert/strict';
import {timestampQuality,validateNewsRecord,validateMarketRecord,inspectBriefing} from '../apps/api/data-quality.js';
const now=Date.parse('2026-10-30T12:00:00Z');
test('source timestamps classify stale and future data',()=>{
 assert.equal(timestampQuality('2026-10-30T11:00:00Z',{now}).status,'current');
 assert.equal(timestampQuality('2026-10-20T11:00:00Z',{now}).status,'stale');
 assert.equal(timestampQuality('2026-11-01T11:00:00Z',{now}).status,'invalid');
 assert.equal(timestampQuality(null,{now}).status,'unknown');
});
test('unverified article URL and future dated source are rejected',()=>{
 const base={category:'news',title:'Detailed market developments',publishedAt:'2026-10-30T11:00:00Z',source:'gdelt'};
 assert.equal(validateNewsRecord({...base,url:'http://example.com/path'},{now}),null);
 assert.equal(validateNewsRecord({...base,url:'https://example.com/path',publishedAt:'2026-11-03T00:00:00Z'},{now}),null);
 assert.ok(validateNewsRecord({...base,url:'https://example.com/path'},{now}));
});
test('rejects invalid market quotes rather than fabricating values',()=>{
 assert.equal(validateMarketRecord({id:'A',title:'Sample market',yesPrice:125},'kalshi'),null);
 assert.equal(validateMarketRecord({id:'A',title:'Sample market',yesPrice:55},'kalshi').yesPrice,55);
 assert.equal(validateMarketRecord({id:'1',title:'Sample market',prices:'[0.7,3]'},'polymarket'),null);
});
test('briefing quality never hides outdated items',()=>{
 const b=inspectBriefing({generatedAt:'2026-10-20T00:00:00Z',sections:[{title:'News',entries:[{title:'Headline',publishedAt:'2026-10-20T00:00:00Z'}]}],warnings:[]},{now});
 assert.equal(b.quality.status,'stale');assert.equal(b.sections[0].entries[0].freshness,'stale');
});

test('financial relevance ranks newer official macro news ahead of unrelated discovery',async()=>{
 const {rankNews}=await import('../apps/api/data-quality.js');
 const items=[{source:'gdelt-global',title:'Celebrity event',summary:'',publishedAt:'2026-10-30T10:00:00Z'},
 {source:'federal-reserve',title:'Interest rates release',summary:'Policy',publishedAt:'2026-10-30T09:00:00Z'}];
 const ranked=rankNews(items,{now});assert.equal(ranked[0].source,'federal-reserve');assert.equal(ranked[0].financiallyRelevant,true);
});
