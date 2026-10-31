import {createHash} from 'node:crypto';
import {XMLParser} from 'fast-xml-parser';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,processEntities:false,trimValues:true});
const list=x=>x==null?[]:Array.isArray(x)?x:[x];
const text=x=>typeof x==='string'?x:(x&&typeof x==='object'?text(x.value??x['#text']):null);
const cap=(x,n=200)=>text(x)?.slice(0,n)||null;
const numeric=x=>{const n=Number(text(x));return Number.isFinite(n)&&n>=0?String(n):null};
const hash=s=>createHash('sha256').update(s).digest('hex');
export function parseForm4(xml,{cik,accession,url,filingDate=null}={}){
 if(typeof xml!=='string'||xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Untrusted Form 4 XML');
 if(!/^\d{1,10}$/.test(String(cik))||!/^\d{10}-\d{2}-\d{6}$/.test(accession||''))throw Error('Missing accession identifiers');
 const root=parser.parse(xml)?.ownershipDocument;
 if(!root||!['4','4/A'].includes(text(root.documentType)))throw Error('Not an ownership Form 4');
 const issuer=root.issuer||{};
 const owner=list(root.reportingOwner).map(x=>[cap(x?.reportingOwnerId?.rptOwnerName,200)]).flat().filter(Boolean).join('; ').slice(0,500)||null;
 const rows=[...list(root.nonDerivativeTable?.nonDerivativeTransaction),...list(root.derivativeTable?.derivativeTransaction)];
 const out=[];
 for(const [i,row] of rows.entries()){
  const core=row?.transactionCoding||{},amt=row?.transactionAmounts||{};
  const date=cap(row?.transactionDate?.value,10);
  const code=cap(core?.transactionCode,8);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!code)continue;
  const entry={cik:String(cik).padStart(10,'0'),accession,
   issuerCik:cap(issuer?.issuerCik,10),issuerTicker:cap(issuer?.issuerTradingSymbol,24),
   reportingOwner:owner,securityTitle:cap(row?.securityTitle?.value,200),
   transactionDate:date,filingDate,transactionCode:code,
   shares:numeric(amt.transactionShares?.value)||numeric(amt.transactionTotalValue?.value),
   pricePerShare:numeric(amt.transactionPricePerShare?.value),
   acquiredDisposed:cap(amt.transactionAcquiredDisposedCode?.value,1),
   directIndirect:cap(row?.ownershipNature?.directOrIndirectOwnership?.value,1),
   sourceUrl:url,
   sourceKey:hash(accession+':'+i+':'+date+':'+code)};
  if(!['A','D'].includes(entry.acquiredDisposed))entry.acquiredDisposed=null;
  out.push(entry);
 }
 return out.slice(0,1000);
}
export async function saveForm4Transactions(db,rows){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid transaction batch');
 let saved=0;
 for(const t of rows){
  const q=await db.query(`INSERT INTO sec_form4_transactions
    (accession,cik,issuer_cik,issuer_ticker,reporting_owner,security_title,transaction_date,filing_date,transaction_code,shares,price_per_share,acquired_disposed,direct_indirect,source_url,source_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    ON CONFLICT(source_key) DO NOTHING`,[
     t.accession,t.cik,t.issuerCik,t.issuerTicker,t.reportingOwner,t.securityTitle,
     t.transactionDate,t.filingDate,t.transactionCode,t.shares,t.pricePerShare,
     t.acquiredDisposed,t.directIndirect,t.sourceUrl,t.sourceKey]);
  saved+=q.rowCount||0;
 }
 return saved;
}
export async function getForm4Transactions(db,{limit=50,ticker=null}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Limit must be 1–100');
 if(ticker!==null&&!/^[A-Z0-9.-]{1,24}$/.test(ticker))throw Error('Invalid ticker');
 const q=await db.query(`SELECT accession,cik,issuer_ticker,reporting_owner,transaction_date,filing_date,
 transaction_code,shares,price_per_share,acquired_disposed,source_url FROM sec_form4_transactions
 WHERE ($1::text IS NULL OR issuer_ticker=$1) ORDER BY transaction_date DESC,id DESC LIMIT $2`,[ticker,limit]);
 return {rows:q.rows,transactionLevel:true,warning:'Public SEC Form 4 data, which may be delayed or amended. Not Congressional transaction data.'};
}
