import {getPool,closePool,saveMarkets} from '../apps/api/database.js';
import {loadMarkets} from '../apps/api/markets.js';
if(!process.env.DATABASE_URL){console.error('DATABASE_URL is required');process.exit(1)}
let failed=false;
try{
 const pool=await getPool();
 const feeds=await loadMarkets();
 const at=new Date(feeds.asOf);
 for(const source of ['kalshi','polymarket']){
  if(feeds.availability[source]!=='fulfilled'){console.error(JSON.stringify({source,status:'upstream_unavailable'}));failed=true;continue}
  const rows=await saveMarkets(pool,source,feeds[source],at);
  console.log(JSON.stringify({source,status:'persisted',rows,observedAt:feeds.asOf}));
 }
}catch(e){console.error(JSON.stringify({status:'ingest_failed',error:e.name}));failed=true}
finally{await closePool()}
if(failed)process.exitCode=1;
