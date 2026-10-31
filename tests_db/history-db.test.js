import test from 'node:test';
import assert from 'node:assert/strict';
import {getPool,closePool} from '../apps/api/database.js';
import {parseHistoricalDataset} from '../apps/api/history-import/parse.js';
import {importDataset,listDatasets,readDataset} from '../apps/api/history-import/store.js';
import {recordSourceChecks,loadSourceHealth} from '../apps/api/quality-monitor.js';
import {app} from '../apps/api/server.js';
const date=i=>new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
const content=['date,AAA,BBB',...Array.from({length:45},(_,i)=>
 [date(i),(100+i*.1).toFixed(2),(30+i*.08).toFixed(2)].join(','))].join('\n');
const metadata={sourceLabel:'CI fixture licensed',licenseNote:'Authorized for internal automated integration tests'};
const dataset=parseHistoricalDataset(content,metadata);
let db,origin;
test.before(async()=>{
 db=await getPool();
 if(!app.listening)await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 origin='http://127.0.0.1:'+app.address().port;
});
test.after(async()=>{
 if(db){
  await db.query('DELETE FROM historical_datasets WHERE dataset_id=$1',[dataset.datasetId]);
  await db.query('DELETE FROM source_health_events WHERE source_name=$1',['ci-quality-probe']);
  await db.query('DELETE FROM source_coverage WHERE source_name=$1',['ci-quality-probe']);
 }
 app.close();
 await closePool();
});
test('PostgreSQL historical import is atomic and duplicates are idempotent',async()=>{
 const a=await importDataset(db,dataset);
 const b=await importDataset(db,dataset);
 assert.equal(a.created,true);
 assert.equal(a.rowsInserted,90);
 assert.equal(b.created,false);
 assert.equal(b.rowsInserted,0);
 const stored=await db.query('SELECT count(*)::int AS n FROM historical_daily_closes WHERE dataset_id=$1',[dataset.datasetId]);
 assert.equal(stored.rows[0].n,90);
});
test('history retrieval and catalog preserve original permission notes',async()=>{
 const catalog=await listDatasets(db);
 assert.ok(catalog.datasets.some(x=>x.dataset_id===dataset.datasetId));
 const stored=await readDataset(db,{datasetId:dataset.datasetId});
 assert.equal(stored.complete,true);
 assert.equal(stored.assets.length,2);
 assert.equal(stored.assets[0].prices.length,45);
 assert.equal(stored.dataset.license_note,metadata.licenseNote);
 assert.equal(stored.dataset.quality.status,'review');
});
test('imported data cannot leak from the default public API',async()=>{
 const a=await fetch(origin+'/api/historical-catalog');
 assert.equal(a.status,403);
 const b=await fetch(origin+'/api/historical-dataset?id='+dataset.datasetId);
 assert.equal(b.status,403);
});
test('collection attempts persist as source-health records',async()=>{
 await db.query(`INSERT INTO source_coverage
 (source_name,last_attempt_at,last_success_at,last_status,item_count)
 VALUES('ci-quality-probe',now(),now(),'partial',3)
 ON CONFLICT(source_name) DO UPDATE SET
 last_attempt_at=now(),last_status='partial',item_count=3`);
 await recordSourceChecks(db,[{name:'ci-quality-probe',status:'partial',items:3}]);
 const health=await loadSourceHealth(db);
 const probe=health.sources.find(x=>x.name==='ci-quality-probe');
 assert.equal(probe.state,'degraded');
 assert.equal(probe.recentPartialCount,1);
});
test('source-health HTTP API uses recorded database events',async()=>{
 const r=await fetch(origin+'/api/data-health');
 assert.equal(r.status,200);
 const result=await r.json();
 assert.equal(result.sourceOfTruth,'PostgreSQL source_coverage and source_health_events');
 assert.ok(result.sources.some(x=>x.name==='ci-quality-probe'));
});
