const SOURCES={
kalshi:'https://api.elections.kalshi.com/trade-api/v2/markets?limit=10&status=open',
polymarket:'https://gamma-api.polymarket.com/markets?limit=10&active=true&closed=false'
};
const CACHE_MS=30000;
let cache={value:null,at:0};
let inflight=null;
async function getRemote(url,{fetcher=fetch,timeout=4500}={}){const res=await fetcher(url,{signal:AbortSignal.timeout(timeout),headers:{'Accept':'application/json'}});if(!res.ok)throw Error('Market source unavailable');const len=Number(res.headers?.get?.('content-length')||0);if(len>2_000_000)throw Error('Market source too large');const text=await res.text();if(text.length>2_000_000)throw Error('Market source too large');return JSON.parse(text)}
const trim=(s,max=260)=>typeof s==='string'?s.slice(0,max):'';
const kalshiRows=x=>Array.isArray(x?.markets)?x.markets.slice(0,10).map(m=>({id:trim(m.ticker,80),title:trim(m.title),yesPrice:Number.isInteger(m.yes_ask)&&m.yes_ask>=0&&m.yes_ask<=100?m.yes_ask:null})):[];
const polyRows=x=>Array.isArray(x)?x.slice(0,10).map(m=>({id:trim(String(m.id??''),80),title:trim(m.question),prices:trim(typeof m.outcomePrices==='string'?m.outcomePrices:JSON.stringify(m.outcomePrices??[]),200)})):[];
export async function loadMarkets({fetcher=fetch,now=Date.now()}={}){if(fetcher===fetch&&cache.value&&now-cache.at<CACHE_MS)return {...cache.value,cache:'hit'};if(fetcher===fetch&&inflight)return inflight;const operation=(async()=>{const [k,p]=await Promise.allSettled([getRemote(SOURCES.kalshi,{fetcher}),getRemote(SOURCES.polymarket,{fetcher})]);const value={kalshi:k.status==='fulfilled'?kalshiRows(k.value):[],polymarket:p.status==='fulfilled'?polyRows(p.value):[],availability:{kalshi:k.status,polymarket:p.status},asOf:new Date(now).toISOString(),cache:'miss'};if(fetcher===fetch){cache={value,at:now}}return value})();if(fetcher===fetch)inflight=operation;try{return await operation}finally{if(fetcher===fetch)inflight=null}}
export const disclosureSources=Object.freeze([{name:'SEC EDGAR',url:'https://www.sec.gov/edgar/search/',kind:'Insider ownership filings'},{name:'US House',url:'https://disclosures-clerk.house.gov/FinancialDisclosure',kind:'Congressional disclosures'},{name:'US Senate',url:'https://efdsearch.senate.gov/search/',kind:'Congressional disclosures'}]);
