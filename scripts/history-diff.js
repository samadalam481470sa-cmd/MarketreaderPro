import {getPool,closePool} from '../apps/api/database.js';
import {compareArchivedHistory} from '../apps/api/history-import/diff.js';
const [from,to,...rest]=process.argv.slice(2);
if(!from||!to||rest.length){
 console.error('Usage: npm run history:diff -- OLDER_SHA256 NEWER_SHA256');
 process.exitCode=2;
}else{
 try{
  console.log(JSON.stringify(await compareArchivedHistory(await getPool(),{from,to}),null,2));
 }catch(e){console.error('History comparison failed: '+e.message);process.exitCode=1}
 finally{await closePool().catch(()=>{})}
}
