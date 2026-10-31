// PostgreSQL integration with environment-only credentials. Never log DATABASE_URL.
import {readdir,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const migrationDir=resolve(dirname(fileURLToPath(import.meta.url)),'../../db/migrations');
let poolPromise;
export const configured=()=>Boolean(process.env.DATABASE_URL);
export async function getPool(){
  if(!configured())throw new Error('Database is not configured');
  if(!poolPromise)poolPromise=(async()=>{
    const {default:pg}=await import('pg');
    return new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,idleTimeoutMillis:30000,connectionTimeoutMillis:5000,
      ssl:process.env.DB_SSL==='require'?{rejectUnauthorized:true}:undefined,application_name:'marketreaderpro'});
  })().catch(e=>{poolPromise=null;throw e});
  return poolPromise;
}
export async function closePool(){if(poolPromise){const pool=await poolPromise;await pool.end();poolPromise=null}}
export async function migrate(pool=undefined){
 const db=pool??await getPool();const client=await db.connect();
 try{
  // Serialize migrations across concurrent releases using session-scoped advisory lock.
  await client.query('SELECT pg_advisory_lock(417832,1042)');
  try{
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const files=(await readdir(migrationDir)).filter(f=>/^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort();
    for(const file of files){
      const exists=await client.query('SELECT 1 FROM schema_migrations WHERE version=$1',[file]);
      if(exists.rowCount)continue;
      const sql=await readFile(resolve(migrationDir,file),'utf8');
      await client.query('BEGIN');
      try{await client.query(sql);await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);await client.query('COMMIT')}
      catch(e){await client.query('ROLLBACK');throw e}
    }
    return files.length;
  }finally{await client.query('SELECT pg_advisory_unlock(417832,1042)')}
 }finally{client.release()}
}
export async function saveMarkets(db,source,rows,observedAt=new Date()){
 if(!['kalshi','polymarket'].includes(source))throw new Error('Unsupported market source');
 if(!Array.isArray(rows)||rows.length>100)throw new Error('Invalid market batch');
 const client=await db.connect();try{
  await client.query('BEGIN');
  const run=await client.query('INSERT INTO ingestion_runs(source_id) VALUES($1) RETURNING id',[source]);
  let count=0;
  for(const row of rows){
   if(typeof row.id!=='string'||!row.id||row.id.length>128||typeof row.title!=='string'||!row.title||row.title.length>500)continue;
   const m=await client.query(`INSERT INTO markets(source_id,external_id,title) VALUES($1,$2,$3)
     ON CONFLICT(source_id,external_id) DO UPDATE SET title=EXCLUDED.title,last_seen_at=now()
     RETURNING id`,[source,row.id,row.title]);
   // Prices are source-dependent. Only canonical probabilities in [0,1] are persisted as normalized.
   const price=source==='kalshi'&&Number.isInteger(row.yesPrice)&&row.yesPrice>=0&&row.yesPrice<=100?row.yesPrice/100:null;
   const raw=source==='kalshi'?{yes_ask:row.yesPrice??null}:{outcome_prices:row.prices??null};
   await client.query('INSERT INTO market_observations(market_id,observed_at,probability,price_raw) VALUES($1,$2,$3,$4) ON CONFLICT(market_id,observed_at) DO NOTHING',
     [m.rows[0].id,observedAt,price,JSON.stringify(raw)]);
   count++;
  }
  await client.query("UPDATE ingestion_runs SET outcome='success',inserted_count=$1,finished_at=now() WHERE id=$2",[count,run.rows[0].id]);
  await client.query('COMMIT');
  return count;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function readHistory(db,{source,externalId,limit=100}){
 if(!['kalshi','polymarket'].includes(source))throw new Error('Invalid source');
 if(typeof externalId!=='string'||externalId.length<1||externalId.length>128)throw new Error('Invalid market ID');
 if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Limit must be 1–500');
 const r=await db.query(`SELECT o.observed_at,o.probability,o.price_raw,m.title
 FROM markets m JOIN market_observations o ON o.market_id=m.id
 WHERE m.source_id=$1 AND m.external_id=$2 ORDER BY o.observed_at DESC,o.id DESC LIMIT $3`,[source,externalId,limit]);
 return {source,id:externalId,history:r.rows,limit};
}
export async function stats(db){const [markets,observations,disclosures,latest]=await Promise.all([
 db.query('SELECT COUNT(*)::integer AS count FROM markets'),
 db.query('SELECT COUNT(*)::integer AS count FROM market_observations'),
 db.query('SELECT COUNT(*)::integer AS count FROM public_disclosures'),
 db.query('SELECT MAX(finished_at) AS last_ingestion FROM ingestion_runs WHERE outcome=$1',['success'])
]);return {markets:markets.rows[0].count,observations:observations.rows[0].count,publicDisclosures:disclosures.rows[0].count,lastIngestion:latest.rows[0].last_ingestion}}
