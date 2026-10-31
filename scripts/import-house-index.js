import {spawn} from 'node:child_process';
import {getPool,closePool} from '../apps/api/database.js';
import readline from 'node:readline';
const [archive,year]=process.argv.slice(2);
if(!archive||!/^20\d\d$/.test(year||''))throw Error('Usage: npm run house:import -- /path/to/HouseAnnual.zip 2026');
if(process.env.HOUSE_DISCLOSURE_USE_AUTHORIZED!=='true')throw Error('House disclosure use requires operator legal review and HOUSE_DISCLOSURE_USE_AUTHORIZED=true');
const child=spawn(process.env.PYTHON||'python3',['scripts/parse-house-index.py',archive,'--year',year],{stdio:['ignore','pipe','inherit']});
let imported=0;const db=await getPool();
try{
 for await(const line of readline.createInterface({input:child.stdout,crlfDelay:Infinity})){
  const row=JSON.parse(line);
  // Store filing index, not inferred purchases/sales or private details.
  const date=row.filedDate?row.filedDate.split('/'):null;
  const iso=date?date[2]+'-'+date[0].padStart(2,'0')+'-'+date[1].padStart(2,'0'):null;
  const q=await db.query(`INSERT INTO official_filing_index
    (source,source_id,filer_name,document_type,filed_date,document_url,source_year)
    VALUES('house',$1,$2,$3,$4,$5,$6) ON CONFLICT(source,source_id) DO NOTHING`,[
     row.sourceId,row.filerName,row.documentType,iso,row.documentUrl,row.sourceYear]);
  imported+=q.rowCount||0;
 }
 const exit=await new Promise(resolve=>child.on('close',resolve));
 if(exit!==0)throw Error('House archive parser failed');
 console.log(JSON.stringify({source:'house',imported,mode:'filing-index-only'}));
}finally{await closePool().catch(()=>{})}
