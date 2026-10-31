import {createHash} from 'node:crypto';
import {parsePortfolioCsv} from '../../web/portfolio-csv.js';
import {validatePortfolio} from '../portfolio-risk/validation.js';
import {assessHistoryQuality} from './quality.js';

export class HistoricalImportError extends Error{
 constructor(message){super(message);this.name='HistoricalImportError';this.status=422}
}
const reject=message=>{throw new HistoricalImportError(message)};
export function validateProvenance({sourceLabel,sourceUrl=null,licenseNote}={}){
 if(typeof sourceLabel!=='string'||sourceLabel.trim().length<3||sourceLabel.trim().length>120)
  reject('A descriptive source label of 3–120 characters is required');
 if(typeof licenseNote!=='string'||licenseNote.trim().length<8||licenseNote.trim().length>500)
  reject('A license/permission note of 8–500 characters is required');
 if(sourceUrl!==null){
  let url;
  try{url=new URL(sourceUrl)}catch{reject('Source URL must be valid HTTPS')}
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.'))
   reject('Source URL must be an HTTPS publisher URL without credentials');
  sourceUrl=url.href;
 }
 return {sourceLabel:sourceLabel.trim(),sourceUrl,licenseNote:licenseNote.trim()};
}
export function parseHistoricalDataset(csv,metadata){
 if(typeof csv!=='string'||Buffer.byteLength(csv,'utf8')>160000)
  reject('Historical import must be a CSV below 160 KB');
 const provenance=validateProvenance(metadata);
 let records;
 try{records=parsePortfolioCsv(csv)}catch(e){reject('CSV rejected: '+e.message)}
 const assets=records.map(a=>({...a,weight:1/records.length}));
 try{validatePortfolio({assets})}catch(e){reject('Historical prices rejected: '+e.message)}
 // Only authorized, deterministic immutable content is persisted.
 const values=records.map(a=>({symbol:a.symbol,prices:a.prices.map(p=>({
  date:new Date(Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(p.date)?p.date+'T00:00:00Z':p.date))
   .toISOString().slice(0,10),close:p.close
 }))}));
 // Normalize every date to UTC day; different timestamps for one local day are invalid.
 const uniqueDays=new Set(values[0].prices.map(p=>p.date));
 if(uniqueDays.size!==values[0].prices.length)reject('CSV contains duplicate UTC days');
 const firstDates=values[0].prices.map(p=>p.date);
 if(values.some(a=>a.prices.some((p,i)=>p.date!==firstDates[i])))
  reject('All assets must have identical UTC calendar dates');
 const quality=assessHistoryQuality(values);
 const normalized={provenance,values};
 const checksumSha256=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
 return {
  datasetId:checksumSha256,
  checksumSha256,
  sourceLabel:provenance.sourceLabel,
  sourceUrl:provenance.sourceUrl,
  licenseNote:provenance.licenseNote,
  symbols:values.map(a=>a.symbol),
  observationCount:firstDates.length,
  assetCount:values.length,
  startDate:firstDates[0],
  endDate:firstDates.at(-1),
  values,quality
 };
}
