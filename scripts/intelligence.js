import {getPool,closePool} from '../apps/api/database.js';
import {ingestIntelligence} from '../apps/api/intelligence.js';
async function main(){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL required');
 const ciks=(process.env.MRP_SEC_CIKS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(ciks.length>50||ciks.some(s=>!/^\d{1,10}$/.test(s)))throw Error('MRP_SEC_CIKS must have at most 50 valid numeric identifiers');
 const db=await getPool();const result=await ingestIntelligence(db,{secCiks:ciks});
 console.log(JSON.stringify({task:'intelligence',...result}));
 if(Object.keys(result.errors).length)process.exitCode=2; // Degraded sources are visible to scheduling infrastructure.
}
try{await main()}catch(e){console.error(JSON.stringify({task:'intelligence',error:e.name}));process.exitCode=1}finally{await closePool().catch(()=>{})}
