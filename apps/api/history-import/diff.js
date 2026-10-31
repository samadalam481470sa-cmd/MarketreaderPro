/**
 * Compares two independently imported immutable archives, including revisions.
 * It does not merge records or prefer the newer imported dataset automatically.
 */
import {readDataset} from './store.js';
import {verifyArchivedDataset} from './integrity.js';

export class HistoryComparisonError extends Error{
 constructor(message){super(message);this.name='HistoryComparisonError';this.status=422}
}
export function compareHistoricalDatasets(left,right){
 if(!left?.dataset||!right?.dataset)throw new HistoryComparisonError('Two stored datasets are required');
 const leftIntegrity=verifyArchivedDataset(left);
 const rightIntegrity=verifyArchivedDataset(right);
 if(leftIntegrity.status!=='verified'||rightIntegrity.status!=='verified')
  throw new HistoryComparisonError('Cannot compare corrupted or incomplete datasets');
 const leftSymbols=new Set(left.assets.map(a=>a.symbol));
 const rightSymbols=new Set(right.assets.map(a=>a.symbol));
 const shared=[...leftSymbols].filter(s=>rightSymbols.has(s)).sort();
 if(!shared.length)throw new HistoryComparisonError('Dataset archives share no symbols');
 const leftBy=new Map(left.assets.map(a=>[a.symbol,new Map(a.prices.map(p=>[p.date,p.close]))]));
 const rightBy=new Map(right.assets.map(a=>[a.symbol,new Map(a.prices.map(p=>[p.date,p.close]))]));
 let observationsCompared=0,changes=0;
 const revisionRows=[],symbols=[];
 for(const symbol of shared){
  const a=leftBy.get(symbol),b=rightBy.get(symbol);
  const common=[...a.keys()].filter(d=>b.has(d)).sort();
  let altered=0,maxAbsoluteFractionalChange=0;
  for(const date of common){
   const old=Number(a.get(date)),current=Number(b.get(date));
   const difference=current-old,relative=difference/old;
   observationsCompared++;
   if(Math.abs(difference)>Math.max(1e-9,Math.abs(old)*1e-9)){
    changes++;altered++;
    maxAbsoluteFractionalChange=Math.max(maxAbsoluteFractionalChange,Math.abs(relative));
    if(revisionRows.length<150)revisionRows.push({
     symbol,date,olderClose:old,newerClose:current,
     absoluteChange:difference,relativeChange:relative
    });
   }
  }
  symbols.push({
   symbol,overlapDays:common.length,olderDays:a.size,newerDays:b.size,
   changedPrices:altered,maxAbsoluteFractionalChange,
   olderOnlyDays:a.size-common.length,newerOnlyDays:b.size-common.length
  });
 }
 const missingFromNew=[...leftSymbols].filter(x=>!rightSymbols.has(x)).sort();
 const addedToNew=[...rightSymbols].filter(x=>!leftSymbols.has(x)).sort();
 return {
  from:left.dataset.dataset_id,
  to:right.dataset.dataset_id,
  identicalArchive:left.dataset.dataset_id===right.dataset.dataset_id,
  sameDeclaredSource:left.dataset.source_label===right.dataset.source_label,
  samePermissionNotice:left.dataset.license_note===right.dataset.license_note,
  sharedSymbols:shared,
  removedSymbols:missingFromNew,
  addedSymbols:addedToNew,
  observationsCompared,
  changedPrices:changes,
  changesBySymbol:symbols,
  sampleRevisions:revisionRows,
  truncatedRevisions:changes>revisionRows.length,
  interpretation:'Differences are archival revisions, not evidence that either value is the correct executable market price.'
 };
}
export async function compareArchivedHistory(db,{from,to}={}){
 if(!/^[a-f0-9]{64}$/.test(from??'')||!/^[a-f0-9]{64}$/.test(to??''))
  throw new HistoryComparisonError('Provide two valid historical dataset SHA-256 IDs');
 const [older,newer]=await Promise.all([
  readDataset(db,{datasetId:from}),readDataset(db,{datasetId:to})
 ]);
 if(!older||!newer)throw Object.assign(Error('Historical dataset ID not found'),{status:404});
 return compareHistoricalDatasets(older,newer);
}
