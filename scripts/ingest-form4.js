// Requires an SEC fair-access User-Agent and operator-configured CIKs. Rate limited.
import {getPool,closePool} from '../apps/api/database.js';
import {fetchSecFilings} from '../apps/api/sec.js';
import {parseForm4,saveForm4Transactions} from '../apps/api/sec-transactions.js';
async function go(){
 if(!process.env.SEC_USER_AGENT||!process.env.SEC_USER_AGENT.includes('@'))throw Error('Set SEC_USER_AGENT with organization/contact');
 const ciks=(process.env.MRP_SEC_CIKS||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!ciks.length)throw Error('Set MRP_SEC_CIKS with approved CIK identifiers');
 if(ciks.length>50||ciks.some(x=>!/^\d{1,10}$/.test(x)))throw Error('At most 50 CIKs per cycle');
 const db=await getPool();let saved=0,failures=0,examined=0;
 for(const cik of ciks){
  let metadata=[];try{metadata=await fetchSecFilings(cik)}catch{failures++;continue}
  for(const filing of metadata.slice(0,20)){
   if(!filing.primaryDocument?.toLowerCase().endsWith('.xml'))continue;
   // SEC metadata's URL already derives from a sanitized accession and document name.
   try{
    const response=await fetch(filing.sourceUrl,{headers:{'User-Agent':process.env.SEC_USER_AGENT,Accept:'application/xml,text/xml'},redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('SEC unavailable');
    if(Number(response.headers.get('content-length')||0)>2000000)throw Error('Oversized filing');
    const xml=await response.text();
    const parsed=parseForm4(xml,{cik:filing.cik,accession:filing.accession,url:filing.sourceUrl,filingDate:filing.filedAt});
    saved+=await saveForm4Transactions(db,parsed);examined++;
   }catch{failures++}
   await new Promise(resolve=>setTimeout(resolve,175));
  }
  await new Promise(resolve=>setTimeout(resolve,175));
 }
 console.log(JSON.stringify({source:'sec-form4',examined,saved,failures,scope:'configured CIKs only'}));
 if(failures)process.exitCode=2;
}
try{await go()}catch(e){console.error(JSON.stringify({error:e.message}));process.exitCode=1}finally{await closePool().catch(()=>{})}
