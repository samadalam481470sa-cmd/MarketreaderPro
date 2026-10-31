import {createHash} from 'node:crypto';
import {loadMarkets} from './markets.js';
import {fetchSecFilings} from './sec.js';
import {saveMarkets} from './database.js';
import {enrichBriefing} from './briefing-ai.js';
import {discoverNews} from './broad-news.js';
import {discoverMarketUniverse} from './market-universe.js';
import {coverageSummary} from './coverage.js';
import {recordSourceChecks} from './quality-monitor.js';
import {validateNewsRecord,validateMarketRecord,inspectBriefing,rankNews} from './data-quality.js';

export const PUBLIC_FEEDS=Object.freeze([
 {id:'federal-reserve',url:'https://www.federalreserve.gov/feeds/press_all.xml',hosts:['www.federalreserve.gov','federalreserve.gov']},
 {id:'bls',url:'https://www.bls.gov/feed/bls_latest.rss',hosts:['www.bls.gov','bls.gov']}
]);
const sha=s=>createHash('sha256').update(s).digest('hex');
function clean(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):parseInt(n,10);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):''}).replace(/&(?:amp|lt|gt|quot|apos);/g,s=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[s])).replace(/<[^>]*>/g,'').trim()}
const tag=(body,name)=>new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i').exec(body)?.[1]||'';
export function parseFeed(xml,feed){
 if(typeof xml!=='string'||xml.length>1_500_000)throw Error('Invalid RSS content');
 const blocks=[...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,60);
 return blocks.flatMap(([,type,body])=>{
  const title=clean(tag(body,'title')).slice(0,500);
  const rawLink=clean(tag(body,'link'))||(/<link\b[^>]*href=["']([^"']+)["']/i.exec(body)?.[1]||'');
  let link;try{link=new URL(rawLink)}catch{return []}
  if(link.protocol!=='https:'||!feed.hosts.includes(link.hostname)||!title)return [];
  const date=Date.parse(clean(tag(body,'pubDate')||tag(body,'published')||tag(body,'updated')));
  if(!Number.isFinite(date))return [];
  const key=sha(clean(tag(body,'guid')||tag(body,'id'))||link.href);
  return [{source:feed.id,category:'macro',key,title,url:link.href,publishedAt:new Date(date).toISOString(),summary:clean(tag(body,'description')||tag(body,'summary')).slice(0,350)}];
 });
}
export async function retrieveFeed(feed,{fetcher=fetch}={}){
 const r=await fetcher(feed.url,{headers:{Accept:'application/rss+xml,application/xml,text/xml'},signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!r.ok)throw Error('Feed HTTP '+r.status);
 if(Number(r.headers?.get?.('content-length')||0)>1_500_000)throw Error('Feed too large');
 const data=await r.text();return parseFeed(data,feed);
}
export async function insertItems(db,rows){
 let count=0;
 for(const row of rows){
  const result=await db.query(`INSERT INTO intelligence_items(source,category,source_key,title,url,published_at,summary)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source,source_key) DO NOTHING`,
   [row.source,row.category,row.key,row.title,row.url,row.publishedAt,row.summary||'']);
  count+=result.rowCount||0;
 }
 return count;
}
export function localDate(now=new Date(),tz='America/Chicago'){
 return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function buildBriefing({day,items=[],markets=[],filings=[],errors={}}){
 const brief={
  date:day,title:'MarketreaderPro morning intelligence — '+day,
  generatedAt:new Date().toISOString(),mode:'source-backed automatic digest',
  coverage:'Official macro news, bounded GDELT cross-publisher discovery, paginated public prediction markets and configured SEC CIK filing metadata. No exhaustive coverage of every publisher, official, or exchange.',
  warnings:Object.entries(errors).map(([source,error])=>source+': '+error),
  sections:[
   {title:'Official macro and financial news',entries:items.slice(0,40).map(x=>({title:x.title,source:x.source,url:x.url,publishedAt:x.published_at||x.publishedAt,summary:x.summary}))},
   {title:'Prediction markets',entries:markets.slice(0,12).map(x=>({title:x.title,source:x.source,url:x.url||null,observation:x.price||null}))},
   {title:'SEC Form 4 filing metadata',entries:filings.slice(0,12).map(x=>({title:x.form+' filing · CIK '+x.cik,source:'SEC EDGAR',url:x.sourceUrl,publishedAt:x.filedAt}))}
  ],
  note:'Not trading advice. SEC filings can lag transactions; filing metadata is not parsed trades. Market feeds may be delayed.'
 };
 return brief;
}
export async function latestIntelligence(db,limit=40){
 const n=Number(limit);if(!Number.isInteger(n)||n<1||n>100)throw Error('Limit must be 1–100');
 const [a,b]=await Promise.all([
  db.query('SELECT source,category,title,url,published_at,summary FROM intelligence_items ORDER BY published_at DESC,id DESC LIMIT $1',[n]),
  db.query('SELECT body FROM daily_briefings ORDER BY briefing_date DESC LIMIT 1')
 ]);
 return {items:a.rows,briefing:b.rows[0]?.body??null};
}
export async function ingestIntelligence(db,{fetcher=fetch,marketLoader=discoverMarketUniverse,newsLoader=discoverNews,secFetcher=fetchSecFilings,secCiks=[],now=new Date()}={}){
 const run=await db.query("INSERT INTO intelligence_runs(status) VALUES('running') RETURNING id");
 const errors={};const allItems=[];const filings=[];let saved=0,marketCount=0;
 try{
  const officialStatus={};
  const feedResults=await Promise.allSettled(PUBLIC_FEEDS.map(f=>retrieveFeed(f,{fetcher})));
  for(let i=0;i<feedResults.length;i++){
   if(feedResults[i].status==='fulfilled'){allItems.push(...feedResults[i].value);officialStatus[PUBLIC_FEEDS[i].id]={status:'ok',items:feedResults[i].value.length}}
   else {errors[PUBLIC_FEEDS[i].id]=feedResults[i].reason?.name||'Unavailable';officialStatus[PUBLIC_FEEDS[i].id]={status:'unavailable',items:0}}
  }
  const newsStatus={};
  try{const discovered=await newsLoader({fetcher});allItems.push(...discovered.rows);Object.assign(errors,discovered.errors);Object.assign(newsStatus,discovered.status)}catch(e){errors.gdelt=e.name}
  const validItems=allItems.map(x=>validateNewsRecord(x,{now:now.getTime()})).filter(Boolean);
  const rejectedNews=allItems.length-validItems.length;
  if(rejectedNews)errors['news-quality']='Rejected '+rejectedNews+' invalid or untrusted records';
  const prioritized=rankNews(validItems,{now:now.getTime()});
  saved=await insertItems(db,prioritized);
  let markets=[];const marketTotals={kalshi:0,polymarket:0};
  try{
   const snapshot=await marketLoader({fetcher});
   Object.assign(errors,snapshot.errors||{});
   for(const source of ['kalshi','polymarket']){
    if((snapshot.availability?.[source]==='fulfilled'||snapshot.status?.[source]?.status==='ok'||snapshot.status?.[source]?.status==='partial')&&Array.isArray(snapshot.rows?.[source]||snapshot[source])){
     const rawRows=snapshot.rows?.[source]||snapshot[source];
     const rowset=rawRows.map(row=>validateMarketRecord(row,source)).filter(Boolean);
     if(rowset.length!==rawRows.length)errors['market-quality-'+source]='Rejected '+(rawRows.length-rowset.length)+' malformed market quotes';
     marketTotals[source]=rowset.length;
     try{for(let offset=0;offset<rowset.length;offset+=100)await saveMarkets(db,source,rowset.slice(offset,offset+100),new Date(snapshot.asOf||now));marketCount+=rowset.length}
     catch(e){errors['market-db-'+source]=e.name}
     markets.push(...rowset.slice(0,6).map(x=>({...x,source})));
    }else errors[source]='Feed unavailable';
   }
  }catch(e){errors.markets=e.name}
  const secStatus={};
  for(const cik of secCiks.slice(0,50)){
   try{
    const r=await secFetcher(cik);filings.push(...r.slice(0,15));secStatus[cik]={status:'ok',items:r.length};
   }catch(e){errors['sec-'+cik]=e.name;secStatus[cik]={status:'unavailable',items:0}}
   if(secCiks.length>1)await new Promise(resolve=>setTimeout(resolve,125));
  }
  const cover=coverageSummary({newsStatus:{...officialStatus,...newsStatus},markets:{kalshi:{status:errors.kalshi?'partial':'ok',items:marketTotals.kalshi},polymarket:{status:errors.polymarket?'partial':'ok',items:marketTotals.polymarket}},sec:secStatus,errors});
  for(const entry of cover.sources){await db.query(`INSERT INTO source_coverage(source_name,last_status,item_count,last_success_at) VALUES($1,$2,$3,CASE WHEN $2='ok' THEN now() ELSE NULL END) ON CONFLICT(source_name) DO UPDATE SET last_attempt_at=now(),last_status=EXCLUDED.last_status,item_count=EXCLUDED.item_count,last_success_at=CASE WHEN EXCLUDED.last_status='ok' THEN now() ELSE source_coverage.last_success_at END`,[entry.name,entry.status,entry.items||0])}
  await recordSourceChecks(db,cover.sources,{now});
  const day=localDate(now);
  const briefing=await enrichBriefing({...buildBriefing({day,items:prioritized,markets,filings,errors}),coverageReport:cover});
  await db.query(`INSERT INTO daily_briefings(briefing_date,timezone,title,body)
   VALUES($1,'America/Chicago',$2,$3) ON CONFLICT(briefing_date) DO UPDATE SET title=EXCLUDED.title,body=EXCLUDED.body,generated_at=now()`,
   [day,briefing.title,JSON.stringify(briefing)]);
  const result={day,newsItems:validItems.length,newItems:saved,markets:marketCount,filings:filings.length,coverage:cover,errors};
  await db.query("UPDATE intelligence_runs SET completed_at=now(),status=$2,results=$3 WHERE id=$1",[run.rows[0].id,Object.keys(errors).length?'partial':'ok',JSON.stringify(result)]);
  return result;
 }catch(e){
  await db.query("UPDATE intelligence_runs SET completed_at=now(),status='failed',results=$2 WHERE id=$1",[run.rows[0].id,JSON.stringify({error:e.name})]);
  throw e;
 }
}
