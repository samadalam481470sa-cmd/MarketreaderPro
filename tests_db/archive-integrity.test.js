import test from 'node:test';
import assert from 'node:assert/strict';
import {getPool,closePool} from '../apps/api/database.js';
import {parseHistoricalDataset} from '../apps/api/history-import/parse.js';
import {importDataset,readDataset} from '../apps/api/history-import/store.js';
import {verifyArchivedDataset,verifyStoredHistory,auditHistoricalArchive} from '../apps/api/history-import/integrity.js';
import {compareArchivedHistory} from '../apps/api/history-import/diff.js';
const date=i=>new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
const fixture=(changed=false)=>['date,AAA,BBB',
 ...Array.from({length:40},(_,i)=>[date(i),100+i*.15+(changed&&i===20?1:0),70+i*.12].join(','))
].join('\n');
const meta={sourceLabel:'CI integrity fixture',licenseNote:'CI-created data for automated internal tests'};
const first=parseHistoricalDataset(fixture(),meta),second=parseHistoricalDataset(fixture(true),meta);
let db;
test.before(async()=>{db=await getPool();await importDataset(db,first);await importDataset(db,second)});
test.after(async()=>{
 if(db){await db.query('DELETE FROM historical_datasets WHERE dataset_id=ANY($1::text[])',[[first.datasetId,second.datasetId]])}
 await closePool();
});
test('checksums survive SQL storage and preserve import provenance',async()=>{
 const report=await verifyStoredHistory(db,first.datasetId);
 assert.equal(report.status,'verified');
 assert.equal(report.sourceAuthenticated,false);
 assert.equal(report.observations,40);
});
test('SQL-backed diff reports the changed date and original amounts',async()=>{
 const report=await compareArchivedHistory(db,{from:first.datasetId,to:second.datasetId});
 assert.equal(report.changedPrices,1);
 assert.equal(report.observationsCompared,80);
 assert.equal(report.sampleRevisions[0].date,date(20));
});
test('archive-wide audit verifies both imported datasets',async()=>{
 const report=await auditHistoricalArchive(db,{limit:50});
 assert.ok(report.results.some(x=>x.datasetId===first.datasetId && x.status==='verified'));
 assert.ok(report.results.some(x=>x.datasetId===second.datasetId && x.status==='verified'));
});
test('in-transaction SQL corruption is caught, without persisting corrupt prices',async()=>{
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  await client.query(`UPDATE historical_daily_closes SET close_price=close_price+9
   WHERE dataset_id=$1 AND symbol=$2 AND observed_on=$3`,[first.datasetId,'AAA',date(10)]);
  const transient=await readDataset(client,{datasetId:first.datasetId});
  const report=verifyArchivedDataset(transient);
  assert.equal(report.status,'failed');
  assert.ok(report.failures.includes('checksum_mismatch'));
 }finally{
  await client.query('ROLLBACK');
  client.release();
 }
 assert.equal((await verifyStoredHistory(db,first.datasetId)).status,'verified');
});
test('invalid hash is rejected before issuing queries',async()=>{
 await assert.rejects(()=>verifyStoredHistory(db,'invalid-id'),/Invalid dataset ID/);
});
