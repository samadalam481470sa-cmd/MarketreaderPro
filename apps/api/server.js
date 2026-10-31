import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {research,scorePortfolio} from './services.js';
import {SECURITY_HEADERS,json,createLimiter,readJson,safeIp,requestId} from './security.js';
import {loadMarkets,disclosureSources} from './markets.js';
import {configured,getPool,readHistory,stats,closePool} from './database.js';
import {register,login,authenticate,logout,paperOrder,paperPortfolio} from './accounts.js';
import {aiResearch} from './ai.js';
import {fetchSecFilings} from './sec.js';
import {createLinkToken,exchangeBankToken,listBankAccounts,unlinkBank} from './banking.js';
import {latestIntelligence} from './intelligence.js';
import {COVERAGE_TARGETS} from './coverage.js';
import {getForm4Transactions} from './sec-transactions.js';
import {technicalAnalysis} from './indicators.js';
import {runBacktest} from './backtest/index.js';
import {analyzePortfolio} from './portfolio-risk/index.js';
import {runPortfolioRebalance} from './portfolio-rebalance/engine.js';
import {buildHistoricalResearch} from './research-lab.js';
import {timestampQuality} from './data-quality.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../web');
const staticFiles=new Map([['/','index.html'],['/index.html','index.html'],['/app.js','app.js'],['/style.css','style.css'],['/dashboard-preview.svg','dashboard-preview.svg'],['/intelligence-dashboard.svg','intelligence-dashboard.svg'],['/government-dashboard.svg','government-dashboard.svg'],['/backtest-ui.js','backtest-ui.js'],['/csv.js','csv.js'],['/portfolio-csv.js','portfolio-csv.js'],['/portfolio-risk-ui.js','portfolio-risk-ui.js'],['/portfolio-rebalance-ui.js','portfolio-rebalance-ui.js']]);
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};
const limiter=createLimiter({limit:90,windowMs:60000});
const started=Date.now();
const listenPort=Number(process.env.PORT??3000);
const experimentalEnabled=()=>process.env.ENABLE_EXPERIMENTAL_FEATURES==='true';
export const app=createServer(async(req,res)=>{
const id=requestId();res.setHeader('X-Request-ID',id);
try{
const path=new URL(req.url,'http://localhost').pathname;
const limited=limiter.allow(safeIp(req));
if(!limited.allowed)return json(res,429,{error:'Rate limit exceeded',requestId:id},{'Retry-After':String(limited.retryAfter)});
if(path.startsWith('/api/')){
  if(path==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,mode:'research-only',uptimeSeconds:Math.floor((Date.now()-started)/1000),timestamp:new Date().toISOString()});
  if(path==='/api/ready'&&req.method==='GET')return json(res,200,{ready:true,dependencies:'no mandatory remote dependencies',mode:'research-only'});
  if(path==='/api/capabilities'&&req.method==='GET')return json(res,200,{mode:'public-research',experimental:experimentalEnabled(),liveTrading:false,liveBankTransfers:false,localGpuInBrowser:false});
  if(path==='/api/portfolio-rebalance'){
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'},{Allow:'POST'});
    const data=await readJson(req,600000);
    try{return json(res,200,runPortfolioRebalance(data))}
    catch(e){return json(res,e.status===422?422:500,{error:e.status===422?e.message:'Allocation simulation failed',requestId:id})}
  }
  if(path==='/api/portfolio-risk'){
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'},{Allow:'POST'});
    const data=await readJson(req,600000);
    try{return json(res,200,analyzePortfolio(data))}
    catch(e){return json(res,e.status===422?422:500,{error:e.status===422?e.message:'Portfolio analysis failed',requestId:id})}
  }
  if(path==='/api/backtest'){
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'},{Allow:'POST'});
    const data=await readJson(req,160000);
    try{return json(res,200,runBacktest(data))}
    catch(e){return json(res,e.status===422?422:500,{error:e.status===422?e.message:'Backtest calculation failed',requestId:id})}
  }
  if(path==='/api/government/filings'&&req.method==='GET'){
    if(!configured())return json(res,503,{error:'Database required'});
    const u=new URL(req.url,'http://localhost'),source=u.searchParams.get('source')||'house';
    if(source!=='house')return json(res,422,{error:'Only House filing indexes available'});
    try{const r=await (await getPool()).query('SELECT source,source_id,filer_name,document_type,filed_date,document_url,source_year FROM official_filing_index WHERE source=$1 ORDER BY filed_date DESC NULLS LAST,id DESC LIMIT 100',[source]);return json(res,200,{source,rows:r.rows,transactionLevel:false,notice:'Index records only. PDFs not verified for transaction detail.'})}catch{return json(res,503,{error:'Disclosure index unavailable'})}
  }
  if(path==='/api/government/sec-transactions'&&req.method==='GET'){
    if(!configured())return json(res,503,{error:'Database required'});
    const u=new URL(req.url,'http://localhost');
    const limit=Number(u.searchParams.get('limit')||50),ticker=u.searchParams.get('ticker');
    try{return json(res,200,await getForm4Transactions(await getPool(),{limit,ticker}))}catch(e){return json(res,e.message.startsWith('Invalid')||e.message.startsWith('Limit')?422:503,{error:'SEC transaction query unavailable'})}
  }
  if(path==='/api/research-lab'&&req.method==='GET'){
    if(!configured())return json(res,503,{error:'PostgreSQL history is required'});
    const u=new URL(req.url,'http://localhost');
    const source=u.searchParams.get('source'),externalId=u.searchParams.get('id');
    const window=Number(u.searchParams.get('window')||10);
    const includePredictions=u.searchParams.get('evaluation')==='true';
    try{
      const history=await readHistory(await getPool(),{source,externalId,limit:500});
      const observations=history.history.filter(x=>x.probability!==null).map(x=>({at:x.observed_at,probability:Number(x.probability)})).reverse();
      return json(res,200,{source,id:externalId,...buildHistoricalResearch(observations,{rollingWindow:window,includePredictions})});
    }catch(e){
      if(e.status===422||/Invalid|Limit|range|Insufficient|historical|ordered|rolling/.test(e.message))return json(res,422,{error:e.message});
      return json(res,503,{error:'Historical research unavailable'});
    }
  }
  if(path==='/api/indicators'&&req.method==='GET'){
    if(!configured())return json(res,503,{error:'Historical PostgreSQL observations required'});
    const u=new URL(req.url,'http://localhost');
    const source=u.searchParams.get('source'),externalId=u.searchParams.get('id');
    const period=Number(u.searchParams.get('period')||14);
    try{
      const history=await readHistory(await getPool(),{source,externalId,limit:500});
      const values=history.history.map(x=>x.probability===null?null:Number(x.probability)).reverse().filter(x=>x!==null&&Number.isFinite(x));
      return json(res,200,{source,id:externalId,...technicalAnalysis({values,period})});
    }catch(e){return json(res,e.status===422||/Invalid|Limit/.test(e.message)?422:503,{error:e.status===422||/Invalid|Limit/.test(e.message)?e.message:'Indicator service unavailable'})}
  }
  if(path==='/api/coverage'&&req.method==='GET'){
    if(!configured())return json(res,200,{configured:false,targets:COVERAGE_TARGETS,sources:[]});
    try{const r=await (await getPool()).query('SELECT source_name,last_attempt_at,last_success_at,last_status,item_count FROM source_coverage ORDER BY source_name');return json(res,200,{configured:true,targets:COVERAGE_TARGETS,sources:r.rows})}catch{return json(res,503,{error:'Coverage unavailable'})}
  }
  if(path==='/api/intelligence'&&req.method==='GET'){
    if(!configured())return json(res,503,{error:'Morning intelligence requires configured PostgreSQL and ingestion',items:[],briefing:null});
    try{return json(res,200,await latestIntelligence(await getPool(),Number(new URL(req.url,'http://localhost').searchParams.get('limit')||40)))}
    catch(e){return json(res,/^Limit/.test(e.message)?422:503,{error:/^Limit/.test(e.message)?e.message:'Intelligence data unavailable'})}
  }
  if(path==='/api/db/status'&&req.method==='GET'){
    if(!configured())return json(res,503,{configured:false,error:'Database is not configured'});
    try{return json(res,200,{configured:true,...await stats(await getPool())})}catch{return json(res,503,{configured:true,error:'Database unavailable'})}
  }
  if(path==='/api/history'&&req.method==='GET'){
    if(!configured())return json(res,503,{error:'Database is not configured'});
    const u=new URL(req.url,'http://localhost');
    const limit=Number(u.searchParams.get('limit')||100);
    try{return json(res,200,await readHistory(await getPool(),{source:u.searchParams.get('source'),externalId:u.searchParams.get('id'),limit}))}
    catch(e){if(e.message.startsWith('Invalid')||e.message.startsWith('Limit'))return json(res,422,{error:e.message});return json(res,503,{error:'Database unavailable'})}
  }
  if(path==='/api/sec/filings'&&req.method==='GET'){
    const cik=new URL(req.url,'http://localhost').searchParams.get('cik');
    try{return json(res,200,{cik,filings:await fetchSecFilings(cik),note:'SEC Form 4 metadata, not parsed trades'})}
    catch(e){return json(res,e.status||502,{error:e.status?e.message:'SEC source unavailable'})}
  }
  if(path==='/api/ai/research'){
    if(!experimentalEnabled())return json(res,503,{error:'Experimental AI research disabled'});
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'},{Allow:'POST'});
    const body=await readJson(req);
    try{return json(res,200,await aiResearch(body?.question))}
    catch(e){return json(res,e.status||502,{error:e.status?e.message:'AI research unavailable'})}
  }
  if(['/api/auth/register','/api/auth/login','/api/auth/logout','/api/account','/api/paper/orders'].includes(path)){
    if(!experimentalEnabled())return json(res,503,{error:'Experimental accounts and simulation disabled'});
    if(!configured())return json(res,503,{error:'PostgreSQL is required for accounts'});
    if(['/api/account'].includes(path)?req.method!=='GET':req.method!=='POST')return json(res,405,{error:'Method not allowed'});
    try{
      const db=await getPool();
      if(path==='/api/auth/register')return json(res,201,{user:await register(db,await readJson(req))});
      if(path==='/api/auth/login')return json(res,200,await login(db,await readJson(req)));
      const user=await authenticate(db,req.headers.authorization);
      if(path==='/api/auth/logout'){await logout(db,user.session_id);return json(res,200,{ok:true})}
      if(path==='/api/account')return json(res,200,{user:{id:user.id,email:user.email},paper:await paperPortfolio(db,user.id)});
      return json(res,201,await paperOrder(db,user.id,await readJson(req)));
    }catch(e){return json(res,e.status||500,{error:e.status?e.message:'Account operation failed',requestId:id})}
  }
  if(['/api/banking/link-token','/api/banking/exchange','/api/banking/accounts','/api/banking/unlink'].includes(path)){
    if(!experimentalEnabled())return json(res,503,{error:'Experimental banking disabled'});
    if(!configured())return json(res,503,{error:'PostgreSQL required'});
    const expected=path==='/api/banking/accounts'?'GET':'POST';
    if(req.method!==expected)return json(res,405,{error:'Method not allowed'});
    try{
      const db=await getPool(),user=await authenticate(db,req.headers.authorization);
      if(path==='/api/banking/link-token')return json(res,200,await createLinkToken(user.id));
      if(path==='/api/banking/accounts')return json(res,200,await listBankAccounts(db,user.id));
      const body=await readJson(req);
      if(path==='/api/banking/exchange')return json(res,200,await exchangeBankToken(db,user.id,body?.publicToken));
      return json(res,200,await unlinkBank(db,user.id,body?.connectionId));
    }catch(e){return json(res,e.status||503,{error:e.status?e.message:'Bank integration unavailable'})}
  }
  if(path==='/api/markets'&&req.method==='GET'){
    const snapshot=await loadMarkets();
    return json(res,200,{...snapshot,freshness:timestampQuality(snapshot.asOf,{maxAgeMs:15*60000}),notice:'Timestamp is time the upstream data was retrieved, not proof of exchange publication or quote execution availability.'});
  }
  if(path==='/api/disclosures'&&req.method==='GET')return json(res,200,{sources:disclosureSources,status:'source-links-only'});
  if(path==='/api/research'||path==='/api/risk'){
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'},{'Allow':'POST'});
    const body=await readJson(req);
    if(body===null||typeof body!=='object'||Array.isArray(body))return json(res,422,{error:'Object expected'});
    try{
      if(path==='/api/risk')return json(res,200,scorePortfolio(body.positions));
      if(typeof body.question!=='string'||body.question.trim().length<4||body.question.length>1500)return json(res,422,{error:'Question must be 4–1500 characters'});
      return json(res,200,research(body.question.trim()));
    }catch(e){return json(res,422,{error:e.message})}
  }
  return json(res,404,{error:'Unknown endpoint',requestId:id});
}
if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'},{'Allow':'GET, HEAD'});
const filename=staticFiles.get(path);if(!filename)return json(res,404,{error:'Not found'});
const asset=filename.endsWith('.svg')?resolve(root,'../../docs/images/'+filename):resolve(root,filename);
const type=types[filename.split('.').pop()];
const bytes=await readFile(asset);
res.writeHead(200,{...SECURITY_HEADERS,'Content-Type':type,'Cache-Control':filename==='index.html'?'no-cache':'public, max-age=300','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
}catch(e){if(e.status)return json(res,e.status,{error:e.message,requestId:id});console.error(JSON.stringify({message:'request_error',requestId:id,error:e.name}));if(!res.headersSent)json(res,500,{error:'Internal server error',requestId:id});else res.destroy()}
});
app.requestTimeout=10000;app.headersTimeout=15000;app.keepAliveTimeout=5000;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
if(!Number.isInteger(listenPort)||listenPort<1||listenPort>65535)throw Error('Invalid PORT');
app.listen(listenPort,'0.0.0.0',()=>console.log(JSON.stringify({message:'marketreaderpro_started',port:listenPort,mode:'research-only'})));
function shutdown(signal){console.log(JSON.stringify({message:'shutdown',signal}));app.close(async()=>{await closePool().catch(()=>{});process.exit(0)});setTimeout(()=>process.exit(1),9000).unref()}
process.once('SIGINT',()=>shutdown('SIGINT'));process.once('SIGTERM',()=>shutdown('SIGTERM'));
}
