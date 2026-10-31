import {getPool,closePool} from '../apps/api/database.js';
const pool=await getPool();try{
 const q=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('schema_migrations','markets','market_observations','public_disclosures','ingestion_runs')");
 const names=new Set(q.rows.map(r=>r.table_name));
 if(names.size!==5)throw Error('Expected schema tables missing');
 console.log(JSON.stringify({status:'database_schema_verified',tables:[...names].sort()}));
}finally{await closePool()}
