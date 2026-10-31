import {getPool,closePool} from '../apps/api/database.js';
const pool=await getPool();try{
 const q=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('schema_migrations','markets','market_observations','public_disclosures','ingestion_runs','intelligence_items','daily_briefings','official_filing_index','sec_form4_transactions','historical_datasets','historical_daily_closes','source_health_events')");
 const names=new Set(q.rows.map(r=>r.table_name));
 if(names.size!==12)throw Error('Expected schema tables missing');
 console.log(JSON.stringify({status:'database_schema_verified',tables:[...names].sort()}));
}finally{await closePool()}
