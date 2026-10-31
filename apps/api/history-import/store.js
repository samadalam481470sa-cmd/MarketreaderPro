/**
 * Explicit operator-controlled PostgreSQL persistence.
 * The import is atomic; duplicate imports do not inflate observations.
 */
export async function importDataset(db,dataset){
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  const insert=await client.query(`
   INSERT INTO historical_datasets
    (dataset_id,source_label,source_url,license_note,checksum_sha256,
     start_date,end_date,symbols,observation_count,asset_count,quality)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
   ON CONFLICT(dataset_id) DO NOTHING
   RETURNING dataset_id
  `,[dataset.datasetId,dataset.sourceLabel,dataset.sourceUrl,dataset.licenseNote,
    dataset.checksumSha256,dataset.startDate,dataset.endDate,
    dataset.symbols,dataset.observationCount,dataset.assetCount,JSON.stringify(dataset.quality)]);
  let added=0;
  if(insert.rowCount){
   for(const asset of dataset.values){
    for(const bar of asset.prices){
     await client.query(`
      INSERT INTO historical_daily_closes(dataset_id,symbol,observed_on,close_price)
      VALUES($1,$2,$3,$4)`,[dataset.datasetId,asset.symbol,bar.date,bar.close]);
     added++;
    }
   }
  }
  await client.query('COMMIT');
  return {datasetId:dataset.datasetId,created:Boolean(insert.rowCount),
   rowsInserted:added,assetCount:dataset.assetCount,observationsPerAsset:dataset.observationCount,
   quality:dataset.quality,sourceLabel:dataset.sourceLabel,
   note:'Data provenance is operator declared, not independently authenticated.'};
 }catch(e){await client.query('ROLLBACK');throw e}
 finally{client.release()}
}
export async function listDatasets(db,{limit=20}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>50)
  throw Object.assign(Error('Limit must be 1–50'),{status:422});
 const r=await db.query(`SELECT dataset_id,source_label,source_url,license_note,
  imported_at,start_date,end_date,symbols,observation_count,asset_count,quality
  FROM historical_datasets ORDER BY imported_at DESC,dataset_id ASC LIMIT $1`,[limit]);
 return {datasets:r.rows,readOnly:true,
  warning:'Imported histories are not independently verified market datasets.'};
}
export async function readDataset(db,{datasetId}={}){
 if(typeof datasetId!=='string'||!/^[a-f0-9]{64}$/.test(datasetId))
  throw Object.assign(Error('Invalid dataset ID'),{status:422});
 const meta=await db.query(`SELECT dataset_id,source_label,source_url,license_note,
  imported_at,start_date,end_date,symbols,observation_count,asset_count,quality
  FROM historical_datasets WHERE dataset_id=$1`,[datasetId]);
 if(!meta.rowCount)return null;
 const r=await db.query(`SELECT symbol,observed_on,close_price
  FROM historical_daily_closes WHERE dataset_id=$1
  ORDER BY observed_on ASC,symbol ASC LIMIT 6000`,[datasetId]);
 const bySymbol=new Map(meta.rows[0].symbols.map(symbol=>[symbol,[]]));
 for(const row of r.rows){
  const day=row.observed_on instanceof Date?row.observed_on.toISOString().slice(0,10):String(row.observed_on).slice(0,10);
  bySymbol.get(row.symbol)?.push({date:day,close:Number(row.close_price)});
 }
 return {dataset:meta.rows[0],
  assets:[...bySymbol].map(([symbol,prices])=>({symbol,prices})),
  complete:r.rows.length===meta.rows[0].asset_count*meta.rows[0].observation_count,
  warning:'Prices are operator-provided and not independently verified.'};
}
