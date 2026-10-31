/**
 * Local operator-only CSV import. No public ingestion route.
 * Example:
 * npm run history:import -- --file data.csv --source "Licensed archive" --license "Authorized research use"
 */
import {readFile} from 'node:fs/promises';
import {getPool,closePool} from '../apps/api/database.js';
import {parseHistoricalDataset} from '../apps/api/history-import/parse.js';
import {importDataset} from '../apps/api/history-import/store.js';
function parseArgs(args){
 const out={};
 for(let i=0;i<args.length;i++){
  const name=args[i];
  if(name==='--dry-run'){out.dryRun=true;continue}
  if(!['--file','--source','--license','--url'].includes(name)||!args[i+1])
   throw Error('Unknown or missing option '+name);
  if(out[name])throw Error('Option supplied twice: '+name);
  out[name]=args[++i];
 }
 if(!out['--file']||!out['--source']||!out['--license'])
  throw Error('Required: --file FILE --source LABEL --license PERMISSION_NOTE');
 return out;
}
let exitCode=0;
try{
 const args=parseArgs(process.argv.slice(2));
 const csv=await readFile(args['--file'],'utf8');
 const dataset=parseHistoricalDataset(csv,{
  sourceLabel:args['--source'],licenseNote:args['--license'],sourceUrl:args['--url']??null
 });
 if(args.dryRun){
  console.log(JSON.stringify({mode:'dry-run',datasetId:dataset.datasetId,
   symbols:dataset.symbols,observationsPerAsset:dataset.observationCount,
   dateRange:[dataset.startDate,dataset.endDate],quality:dataset.quality}));
 }else{
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required unless --dry-run');
  const result=await importDataset(await getPool(),dataset);
  console.log(JSON.stringify({mode:'import',...result}));
 }
}catch(e){console.error(JSON.stringify({status:'error',message:e.message}));exitCode=1}
finally{await closePool().catch(()=>{})}
process.exitCode=exitCode;
