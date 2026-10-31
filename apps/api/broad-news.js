import {createHash} from 'node:crypto';
const TOPICS=Object.freeze([
 {id:'global-markets',query:'("stock market" OR "financial markets" OR "bond yields")'},
 {id:'digital-assets',query:'("bitcoin" OR "cryptocurrency" OR "digital assets")'},
 {id:'energy-commodities',query:'("oil prices" OR "gold prices" OR "natural gas")'},
 {id:'government-finance',query:'("congressional trading" OR "federal reserve" OR "economic policy")'}
]);
const sha=v=>createHash('sha256').update(v).digest('hex');
export function parseGdelt(payload,topic){
 if(!Array.isArray(payload?.articles))throw Error('Unexpected GDELT schema');
 return payload.articles.slice(0,100).flatMap(a=>{
  const title=typeof a.title==='string'?a.title.trim().slice(0,500):'';
  let uri;try{uri=new URL(a.url)}catch{return []}
  if(uri.protocol!=='https:'||!title||!uri.hostname.includes('.'))return [];
  const stamp=String(a.seendate||'');
  const parsed=/^\d{14}$/.test(stamp)?Date.UTC(+stamp.slice(0,4),+stamp.slice(4,6)-1,+stamp.slice(6,8),+stamp.slice(8,10),+stamp.slice(10,12),+stamp.slice(12,14)):NaN;
  if(!Number.isFinite(parsed))return [];
  // Titles and original article URLs only; full copyrighted articles are never copied.
  return [{source:'gdelt-'+topic.id,category:'news',key:sha(uri.href),title,url:uri.href,publishedAt:new Date(parsed).toISOString(),summary:'Discovery via GDELT. Verify the original publisher and publication date.'}];
 });
}
export async function fetchGdelt(topic,{fetcher=fetch}={}){
 const endpoint=new URL('https://api.gdeltproject.org/api/v2/doc/doc');
 endpoint.searchParams.set('query',topic.query);
 endpoint.searchParams.set('mode','artlist');
 endpoint.searchParams.set('format','json');
 endpoint.searchParams.set('timespan','1day');
 endpoint.searchParams.set('maxrecords','75');
 endpoint.searchParams.set('sort','datedesc');
 const response=await fetcher(endpoint,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('GDELT response '+response.status);
 if(Number(response.headers?.get?.('content-length')||0)>1500000)throw Error('Response too large');
 const text=await response.text();if(text.length>1500000)throw Error('Response too large');
 return parseGdelt(JSON.parse(text),topic);
}
export async function discoverNews({fetcher=fetch,topics=TOPICS}={}){
 const settled=await Promise.allSettled(topics.map(topic=>fetchGdelt(topic,{fetcher})));
 const rows=[],errors={},status={};
 for(let i=0;i<topics.length;i++){
  const topic=topics[i],v=settled[i];
  if(v.status==='fulfilled'){rows.push(...v.value);status[topic.id]={status:'ok',items:v.value.length}}
  else {errors['gdelt-'+topic.id]=v.reason?.name||'Unavailable';status[topic.id]={status:'unavailable',items:0}}
 }
 return {rows,errors,status};
}
export {TOPICS as NEWS_TOPICS};
