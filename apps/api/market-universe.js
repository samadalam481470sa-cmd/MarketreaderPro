/* Wider prediction-market discovery for the intelligence worker.
 * Uses bounded pagination and deduplication, not a claim of complete exchange coverage.
 */
export async function discoverMarketUniverse({fetcher=fetch,pages=3,pageSize=100}={}){
 if(!Number.isInteger(pages)||pages<1||pages>10||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw Error('Invalid discovery limits');
 const rows={kalshi:[],polymarket:[]},errors={},status={};
 let cursor;
 for(let i=0;i<pages;i++){
  const u=new URL('https://api.elections.kalshi.com/trade-api/v2/markets');
  u.searchParams.set('limit',String(pageSize));u.searchParams.set('status','open');if(cursor)u.searchParams.set('cursor',cursor);
  try{
   const r=await fetcher(u,{signal:AbortSignal.timeout(7500),headers:{Accept:'application/json'},redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);
   const text=await r.text();if(text.length>2000000)throw Error('Body too large');
   const j=JSON.parse(text);
   if(!Array.isArray(j.markets))throw Error('Schema mismatch');
   for(const market of j.markets)if(typeof market.ticker==='string'&&typeof market.title==='string')rows.kalshi.push({id:market.ticker.slice(0,128),title:market.title.slice(0,500),yesPrice:Number.isInteger(market.yes_ask)&&market.yes_ask>=0&&market.yes_ask<=100?market.yes_ask:null});
   if(!j.cursor||j.cursor===cursor)break;cursor=j.cursor;
  }catch(e){errors.kalshi=e.name;break}
 }
 for(let i=0;i<pages;i++){
  const u=new URL('https://gamma-api.polymarket.com/markets');
  u.searchParams.set('limit',String(pageSize));u.searchParams.set('offset',String(i*pageSize));u.searchParams.set('active','true');u.searchParams.set('closed','false');
  try{
   const r=await fetcher(u,{signal:AbortSignal.timeout(7500),headers:{Accept:'application/json'},redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status);
   const text=await r.text();if(text.length>2000000)throw Error('Body too large');
   const j=JSON.parse(text);if(!Array.isArray(j))throw Error('Schema mismatch');
   for(const market of j)if(market.id!=null&&typeof market.question==='string')rows.polymarket.push({id:String(market.id).slice(0,128),title:market.question.slice(0,500),prices:typeof market.outcomePrices==='string'?market.outcomePrices.slice(0,200):JSON.stringify(market.outcomePrices??[])});
   if(j.length<pageSize)break;
  }catch(e){errors.polymarket=e.name;break}
 }
 for(const name of Object.keys(rows)){rows[name]=[...new Map(rows[name].map(m=>[m.id,m])).values()];status[name]={status:errors[name]?'partial':'ok',items:rows[name].length}}
 return {rows,status,errors};
}
