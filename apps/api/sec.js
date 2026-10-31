// Public SEC submission discovery, not transaction extraction or an insider-trading signal.
export function validateCik(cik){if(typeof cik!=='string'||!/^\d{1,10}$/.test(cik))throw Object.assign(Error('CIK must be 1–10 digits'),{status:422});return cik.padStart(10,'0')}
export async function fetchSecFilings(cik,{fetcher=fetch,userAgent=process.env.SEC_USER_AGENT}={}){
 const id=validateCik(cik);
 if(!userAgent||userAgent.length<12||!userAgent.includes('@'))throw Object.assign(Error('Configure SEC_USER_AGENT with an organization and contact email'),{status:503});
 const res=await fetcher('https://data.sec.gov/submissions/CIK'+id+'.json',{headers:{'User-Agent':userAgent,'Accept':'application/json'},signal:AbortSignal.timeout(7000)});
 if(!res.ok)throw Object.assign(Error('SEC source unavailable'),{status:502});
 const data=await res.json(),r=data.filings?.recent;
 if(!r||!Array.isArray(r.form))throw Object.assign(Error('Unexpected SEC response'),{status:502});
 const out=[];
 for(let i=0;i<r.form.length&&out.length<100;i++){
  if(!['4','4/A'].includes(r.form[i]))continue;
  const accession=r.accessionNumber?.[i],date=r.filingDate?.[i],document=r.primaryDocument?.[i];
  if(!/^\d{10}-\d{2}-\d{6}$/.test(accession||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))continue;
  const acc=accession.replaceAll('-','');
  const doc=typeof document==='string'&&/^[a-z0-9_.-]{1,180}$/i.test(document)?document:null;
  const url='https://www.sec.gov/Archives/edgar/data/'+Number(id)+'/'+acc+'/'+(doc||'');
  out.push({cik:id,accession,form:r.form[i],filedAt:date,reportAt:r.reportDate?.[i]||null,primaryDocument:doc,sourceUrl:url});
 }
 return out;
}
export async function saveSecFilings(db,rows){
 if(rows.length>100)throw Error('Too many filings');
 const client=await db.connect();try{await client.query('BEGIN');let count=0;
 for(const r of rows){
  await client.query(`INSERT INTO sec_filing_events(cik,accession,form,filed_at,report_at,primary_document,source_url)
  VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(cik,accession) DO UPDATE SET fetched_at=now()`,[r.cik,r.accession,r.form,r.filedAt,r.reportAt||null,r.primaryDocument,r.sourceUrl]);count++;
 }
 await client.query('COMMIT');return count;
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
