import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoricalDataset,validateProvenance} from '../apps/api/history-import/parse.js';
import {assessHistoryQuality} from '../apps/api/history-import/quality.js';
const csv=()=>['date,AAA,BBB',...Array.from({length:42},(_,i)=>{
 const date=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10);
 return [date,(100+i*.2).toFixed(2),(50+i*.08).toFixed(2)].join(',');
})].join('\n');
const metadata={sourceLabel:'Operator licensed history',licenseNote:'Permitted internal research archive',sourceUrl:'https://example.org/data'};
test('accepts aligned real source format and creates deterministic checksum',()=>{
 const a=parseHistoricalDataset(csv(),metadata);
 const b=parseHistoricalDataset(csv(),metadata);
 assert.equal(a.datasetId,b.datasetId);
 assert.equal(a.assetCount,2);
 assert.equal(a.observationCount,42);
 assert.equal(a.sourceLabel,metadata.sourceLabel);
 assert.equal(a.quality.status,'review'); // old source data are flagged, not considered current
});
test('distinct license terms cannot silently collapse provenance',()=>{
 const a=parseHistoricalDataset(csv(),metadata);
 const b=parseHistoricalDataset(csv(),{...metadata,licenseNote:'Different licensed permission notice'});
 assert.notEqual(a.datasetId,b.datasetId);
});
test('invalid publisher or missing license details are refused',()=>{
 assert.throws(()=>validateProvenance({...metadata,licenseNote:'short'}),/license/);
 assert.throws(()=>validateProvenance({...metadata,sourceUrl:'http://example.org'}),/HTTPS/);
 assert.throws(()=>validateProvenance({...metadata,sourceUrl:'https://u:p@example.org'}),/credentials/);
});
test('malformed closes and duplicate dates are rejected',()=>{
 assert.throws(()=>parseHistoricalDataset(csv().replace('100.00','-100.00'),metadata),/CSV rejected/);
 const broken=csv().split('\n');
 broken[3]=broken[3].replace('2025-01-03','2025-01-02');
 assert.throws(()=>parseHistoricalDataset(broken.join('\n'),metadata),/ascending|increasing/);
});
test('unusual moves are recorded as warnings but never silently changed',()=>{
 const a=parseHistoricalDataset(csv(),metadata);
 const prices=a.values.map(v=>({...v,prices:[...v.prices]}));
 prices[0].prices[4]={...prices[0].prices[4],close:500};
 const quality=assessHistoryQuality(prices);
 assert.ok(quality.warnings.some(x=>x.includes('30%')));
});
