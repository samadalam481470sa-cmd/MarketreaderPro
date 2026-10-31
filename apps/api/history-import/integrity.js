/**
 * Recomputes operator-supplied archive checksums from PostgreSQL records.
 * This detects corruption, silent revisions, partial writes and metadata drift;
 * it cannot independently authenticate a licensed financial-data publisher.
 */
import {createHash} from 'node:crypto';
import {readDataset} from './store.js';
import {validatePortfolio} from '../portfolio-risk/validation.js';

const sha256=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);

export function calculateDatasetDigest(metadata,assets) {
 const provenance={
  sourceLabel:metadata.source_label,
  sourceUrl:metadata.source_url,
  licenseNote:metadata.license_note
 };
 const values=assets.map(asset=>({
  symbol:asset.symbol,
  prices:asset.prices.map(price=>({date:day(price.date),close:Number(price.close)}))
 }));
 return sha256({provenance,values});
}
export function verifyArchivedDataset(stored){
 if(!stored || !stored.dataset)throw Object.assign(Error('Missing historical dataset'),{status:404});
 const meta=stored.dataset;
 const failures=[];
 const assetSymbols=stored.assets.map(x=>x.symbol);
 if(!stored.complete)failures.push('observation_rows_missing');
 if(assetSymbols.length!==meta.asset_count)failures.push('asset_count_mismatch');
 if(stored.assets.some(a=>a.prices.length!==meta.observation_count))
  failures.push('incomplete_symbol_history');
 if(JSON.stringify(assetSymbols)!==JSON.stringify(meta.symbols))
  failures.push('symbol_order_mismatch');
 try{
  validatePortfolio({assets:stored.assets.map(a=>({
   ...a,weight:1/stored.assets.length
  }))});
 }catch{failures.push('invalid_or_unaligned_prices')}
 const dates=stored.assets[0]?.prices.map(p=>day(p.date))??[];
 if(dates.length && (dates[0]!==day(meta.start_date)||
    dates.at(-1)!==day(meta.end_date)))failures.push('stored_date_range_mismatch');
 const calculatedChecksum=calculateDatasetDigest(meta,stored.assets);
 if(calculatedChecksum!==meta.checksum_sha256 ||
    calculatedChecksum!==meta.dataset_id)failures.push('checksum_mismatch');
 return {
  datasetId:meta.dataset_id,
  status:failures.length?'failed':'verified',
  checksum:calculatedChecksum,
  storedChecksum:meta.checksum_sha256,
  sourceLabel:meta.source_label,
  sourceAuthenticated:false,
  observations:dates.length,
  assetCount:stored.assets.length,
  checks:{
   normalizedChecksumMatches:calculatedChecksum===meta.checksum_sha256,
   stableIdentifierMatches:calculatedChecksum===meta.dataset_id,
   expectedRowsPresent:stored.complete,
   chronologyAndAlignment:!failures.includes('invalid_or_unaligned_prices')
  },
  failures,
  limitation:'A matching checksum verifies storage integrity, not exchange authenticity, vendor corrections or licensing.'
 };
}
export async function verifyStoredHistory(db,datasetId){
 const stored=await readDataset(db,{datasetId});
 if(!stored)return null;
 return verifyArchivedDataset(stored);
}
export async function auditHistoricalArchive(db,{limit=50}={}){
 if(!Number.isInteger(limit)||limit<1||limit>50)
  throw Object.assign(Error('Audit limit must be 1–50'),{status:422});
 const r=await db.query('SELECT dataset_id FROM historical_datasets ORDER BY imported_at DESC,dataset_id LIMIT $1',[limit]);
 const results=[];
 for(const x of r.rows){
  const verified=await verifyStoredHistory(db,x.dataset_id);
  results.push(verified);
 }
 return {
  checked:results.length,
  verified:results.filter(x=>x?.status==='verified').length,
  failed:results.filter(x=>x?.status!=='verified').length,
  results,
  warning:'Checksums prove that stored bytes match the original operator import, not that prices are true or distributable.'
 };
}
