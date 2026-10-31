import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoricalDataset,validateProvenance} from '../apps/api/history-import/parse.js';
import {assessHistoryQuality} from '../apps/api/history-import/quality.js';
const file=(days=45,large=false)=>{
 const rows=['date,AAA,BBB'];
 for(let i=0;i<days;i++){
  const date=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10);
  const a=100+i*.2*(large?15:1);
  rows.push([date,a.toFixed(3),(60+i*.01).toFixed(3)].join(','));
 }
 return rows.join('\n');
};
const meta={sourceLabel:'Operator licensed data',licenseNote:'Permitted local research archive',
 sourceUrl:'https://example.org/market-data'};
test('import parsing records immutable identity and provenance',()=>{
 const a=parseHistoricalDataset(file(),meta);
 const b=parseHistoricalDataset(file(),meta);
 assert.equal(a.datasetId,b.datasetId);
 assert.equal(a.assetCount,2);
 assert.equal(a.observationCount,45);
 assert.equal(a.sourceUrl,meta.sourceUrl);
 assert.equal(a.quality.status,'validated-format');
 assert.equal(a.values[0].prices[0].date,'2025-01-01');
});
test('same prices but different licensing metadata result in distinct archives',()=>{
 const a=parseHistoricalDataset(file(),meta);
 const b=parseHistoricalDataset(file(),{...meta,licenseNote:'Different restricted permission notice'});
 assert.notEqual(a.datasetId,b.datasetId);
});
test('rejects data with missing or suspicious authorization metadata',()=>{
 assert.throws(()=>parseHistoricalDataset(file(),{...meta,licenseNote:'short'}),/license/);
 assert.throws(()=>parseHistoricalDataset(file(),{...meta,sourceUrl:'http://example.org'}),/HTTPS/);
 assert.throws(()=>validateProvenance({...meta,sourceUrl:'https://alice:pw@example.com'}),/credentials/);
});
test('cannot pass malformed closes or unaligned historical timestamps',()=>{
 assert.throws(()=>parseHistoricalDataset(file().replace('100.000','-1.000'),meta),/CSV rejected/);
 const rows=file().split('\n');
 rows[3]=rows[3].replace('2025-01-03','2025-01-02');
 assert.throws(()=>parseHistoricalDataset(rows.join('\n'),meta),/strictly increasing/);
});
test('quality alerts detect outsized daily changes without altering source prices',()=>{
 const a=parseHistoricalDataset(file(45,true),meta);
 assert.equal(a.quality.assets.length,2);
 assert.equal(a.quality.sampleDates.start,'2025-01-01');
 const values=a.values.map(x=>({...x,prices:[...x.prices]}));
 values[0].prices[3]={...values[0].prices[3],close:300};
 const quality=assessHistoryQuality(values);
 assert.ok(quality.warnings.some(x=>x.includes('30%')));
});
