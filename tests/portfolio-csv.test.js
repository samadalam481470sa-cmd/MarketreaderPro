import test from 'node:test';import assert from 'node:assert/strict';
import {parsePortfolioCsv,applyWeights} from '../apps/web/portfolio-csv.js';
function content(count=40){
 return ['date,AAA,BBB',...Array.from({length:count},(_,i)=>{
  const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
  return date+','+(100+i)+','+(200+i);
 })].join('\n');
}
test('parses aligned price columns without inventing source data',()=>{
 const assets=parsePortfolioCsv(content());
 assert.equal(assets.length,2);assert.equal(assets[0].prices.length,40);
 assert.equal(assets[1].prices[0].close,200);
});
test('applies equal weights by default and explicit matching weights',()=>{
 const raw=parsePortfolioCsv(content());
 const equally=applyWeights(raw);
 assert.equal(equally[0].weight,.5);
 const configured=applyWeights(raw,'AAA:0.7,BBB:0.3');
 assert.equal(configured[0].weight,.7);
 assert.equal(configured[1].weight,.3);
});
test('rejects malformed weights, duplicate symbols, missing data',()=>{
 const raw=parsePortfolioCsv(content());
 assert.throws(()=>applyWeights(raw,'AAA:1'),/every/);
 assert.throws(()=>applyWeights(raw,'AAA:0.5,BBB:0.4'),/add up/);
 assert.throws(()=>parsePortfolioCsv(content().replace('date,AAA,BBB','date,AAA,AAA')),/unique/);
 assert.throws(()=>parsePortfolioCsv(content().replace('100,200','100,')),/Missing/);
});
