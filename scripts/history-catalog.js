import {getPool,closePool} from '../apps/api/database.js';
import {listDatasets} from '../apps/api/history-import/store.js';
try{
 const pool=await getPool();
 const result=await listDatasets(pool,{limit:50});
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error('Historical catalog unavailable: '+e.message);process.exitCode=1}
finally{await closePool().catch(()=>{})}
