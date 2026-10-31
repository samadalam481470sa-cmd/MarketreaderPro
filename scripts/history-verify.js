import {getPool,closePool} from '../apps/api/database.js';
import {auditHistoricalArchive,verifyStoredHistory} from '../apps/api/history-import/integrity.js';
const argv=process.argv.slice(2);
const position=argv.indexOf('--id');
const datasetId=position>=0?argv[position+1]:null;
if(argv.length && (position!==0||argv.length!==2||!datasetId)){
 console.error('Usage: npm run history:verify -- [--id SHA256]');
 process.exitCode=2;
}else{
 try{
  const db=await getPool();
  const report=datasetId?await verifyStoredHistory(db,datasetId):
   await auditHistoricalArchive(db);
  console.log(JSON.stringify(report,null,2));
  if(!report || report.status==='failed'||report.failed>0)process.exitCode=1;
 }catch(e){console.error('History integrity audit failed: '+e.message);process.exitCode=1}
 finally{await closePool().catch(()=>{})}
}
