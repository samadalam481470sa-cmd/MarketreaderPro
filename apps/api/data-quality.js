// Source-aware quality classification. Never infer freshness from request time alone.
export const QUALITY_POLICY=Object.freeze({
 newsMaxAgeHours:48,macroMaxAgeHours:168,secMaxDelayDays:365,
 marketSnapshotMaxAgeMinutes:15,maxFutureClockSkewMinutes:15
});
export function timestampQuality(value,{now=Date.now(),maxAgeMs=48*3600000}={}){
 const time=typeof value==='number'?value:Date.parse(value);
 if(!Number.isFinite(time))return {status:'unknown',ageSeconds:null,reason:'Missing or invalid source timestamp'};
 const ageMs=now-time;
 if(ageMs< -QUALITY_POLICY.maxFutureClockSkewMinutes*60000)return {status:'invalid',ageSeconds:null,reason:'Source timestamp is in the future'};
 return {status:ageMs>maxAgeMs?'stale':'current',ageSeconds:Math.max(0,Math.floor(ageMs/1000)),reason:ageMs>maxAgeMs?'Source timestamp exceeds freshness window':null};
}
export function validateNewsRecord(item,{now=Date.now()}={}){
 if(!item||typeof item!=='object'||!['macro','news'].includes(item.category)||typeof item.title!=='string'||item.title.trim().length<5||item.title.length>500)return null;
 let url;try{url=new URL(item.url)}catch{return null}
 if(url.protocol!=='https:'||url.username||url.password||url.hostname==='localhost')return null;
 const quality=timestampQuality(item.publishedAt,{now,maxAgeMs:(item.category==='macro'?QUALITY_POLICY.macroMaxAgeHours:QUALITY_POLICY.newsMaxAgeHours)*3600000});
 if(quality.status==='invalid'||quality.status==='unknown')return null;
 return {...item,url:url.href,quality};
}
export function validateMarketRecord(row,source){
 if(!['kalshi','polymarket'].includes(source)||typeof row?.id!=='string'||row.id.length<1||row.id.length>128||typeof row.title!=='string'||row.title.length<3||row.title.length>500)return null;
 if(source==='kalshi'){
  const ask=row.yesPrice;
  return ask===null||ask===undefined||Number.isInteger(ask)&&ask>=0&&ask<=100?row:null;
 }
 let values=row.prices;
 try{if(typeof values==='string')values=JSON.parse(values)}catch{return null}
 if(!Array.isArray(values)||values.length<1||values.length>10)return null;
 if(values.some(x=>x===null||x===''||!Number.isFinite(Number(x))||Number(x)<0||Number(x)>1))return null;
 return row;
}
export function inspectBriefing(brief,{now=Date.now()}={}){
 const generated=timestampQuality(brief?.generatedAt,{now,maxAgeMs:36*3600000});
 const sections=(brief?.sections||[]).map(s=>({
  title:s.title,
  entries:(s.entries||[]).map(x=>({
   ...x,freshness:x.publishedAt?timestampQuality(x.publishedAt,{now,maxAgeMs:48*3600000}).status:'undated'
  }))
 }));
 return {...brief,sections,quality:{status:generated.status,generatedAgeSeconds:generated.ageSeconds,hasSourceWarnings:Boolean(brief?.warnings?.length),policy:'Displayed dates are source/filing timestamps; never claim real-time official reporting.'}};
}
