import {getPool,closePool} from '../apps/api/database.js';
import {fetchSecFilings,saveSecFilings} from '../apps/api/sec.js';
const cik=process.argv[2];
if(!cik){console.error('Usage: npm run sec:ingest -- 0000320193');process.exit(1)}
try{const filings=await fetchSecFilings(cik);const pool=await getPool();const count=await saveSecFilings(pool,filings);console.log(JSON.stringify({cik,insertedOrUpdated:count,note:'SEC Form 4 filing metadata only; transactions not parsed'}))}
catch(e){console.error(JSON.stringify({error:e.message}));process.exitCode=1}
finally{await closePool()}
