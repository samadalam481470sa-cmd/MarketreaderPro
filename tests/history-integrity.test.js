import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoricalDataset} from '../apps/api/history-import/parse.js';
import {verifyArchivedDataset} from '../apps/api/history-import/integrity.js';
import {compareHistoricalDatasets,HistoryComparisonError} from '../apps/api/history-import/diff.js';
const dataset=(shift=0)=>parseHistoricalDataset([
 'date,AAA,BBB',...Array.from({length:42},(_,i)=>{
  const date=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10);
  return [date,100+i*.1+(i===30?shift:0),70+i*.2].join(',');
 })
].join('\n'),{
 sourceLabel:'Test-licensed archive',
 licenseNote:'Unit test data generated in-house'
});
const asStored=d=>({
 dataset:{dataset_id:d.datasetId,checksum_sha256:d.checksumSha256,
  source_label:d.sourceLabel,source_url:d.sourceUrl,license_note:d.licenseNote,
  symbols:d.symbols,asset_count:d.assetCount,observation_count:d.observationCount,
  start_date:d.startDate,end_date:d.endDate},
 assets:d.values,complete:true
});
test('verified, immutable archive round-trips its normalized checksum',()=>{
 const report=verifyArchivedDataset(asStored(dataset()));
 assert.equal(report.status,'verified');
 assert.equal(report.checks.normalizedChecksumMatches,true);
 assert.deepEqual(report.failures,[]);
});
test('tampering with one persisted value triggers a checksum failure',()=>{
 const stored=structuredClone(asStored(dataset()));
 stored.assets[0].prices[20].close=900;
 const report=verifyArchivedDataset(stored);
 assert.equal(report.status,'failed');
 assert.ok(report.failures.includes('checksum_mismatch'));
});
test('truncated archive detects both a partial row count and changed hash',()=>{
 const stored=structuredClone(asStored(dataset()));
 stored.assets[1].prices.pop();stored.complete=false;
 const report=verifyArchivedDataset(stored);
 assert.equal(report.status,'failed');
 assert.ok(report.failures.includes('incomplete_symbol_history'));
});
test('compare revisions with per-symbol and per-day changes',()=>{
 const a=asStored(dataset()),b=asStored(dataset(3));
 const report=compareHistoricalDatasets(a,b);
 assert.equal(report.changedPrices,1);
 assert.equal(report.observationsCompared,84);
 assert.equal(report.sampleRevisions[0].date,'2025-01-31');
 assert.equal(report.sampleRevisions[0].symbol,'AAA');
 assert.ok(report.sampleRevisions[0].relativeChange>0);
});
test('identical archive is not reported as a price revision',()=>{
 const a=asStored(dataset());
 const r=compareHistoricalDatasets(a,structuredClone(a));
 assert.equal(r.identicalArchive,true);
 assert.equal(r.changedPrices,0);
});
test('corrupt archive cannot be used to establish revision accuracy',()=>{
 const a=asStored(dataset()),b=asStored(dataset(1));
 b.assets[0].prices[0].close+=1;
 assert.throws(()=>compareHistoricalDatasets(a,b),HistoryComparisonError);
});
