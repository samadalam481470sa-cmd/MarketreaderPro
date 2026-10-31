// Optional explanatory text derived ONLY from already-curated PUBLIC briefing entries.
export async function enrichBriefing(briefing,{fetcher=fetch,env=process.env}={}){
 if(env.AI_BRIEFING_ENABLED!=='true')return {...briefing,ai:{enabled:false,status:'disabled'}};
 if(!env.AI_API_KEY||!env.AI_MODEL)return {...briefing,ai:{enabled:true,status:'unconfigured'}};
 const entries=briefing.sections.flatMap(s=>s.entries.map(x=>({source:x.source,title:x.title,url:x.url||null,publishedAt:x.publishedAt||null}))).slice(0,15);
 if(!entries.length)return {...briefing,ai:{enabled:true,status:'insufficient-sources'}};
 const prompt='You are a financial news explainer. Explain why these publicly sourced headlines may matter using only the listed facts. Do not invent market prices, cite nonexistent filings, fabricate quotes or give personalized buy/sell instructions. Be concise and list uncertainty. You may say that the supplied data is insufficient.';
 try{
  const r=await fetcher('https://api.openai.com/v1/chat/completions',{
   method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.AI_API_KEY},
   signal:AbortSignal.timeout(12000),
   body:JSON.stringify({model:env.AI_MODEL,messages:[{role:'system',content:prompt},{role:'user',content:JSON.stringify(entries)}],max_completion_tokens:350,temperature:0.2})
  });
  if(!r.ok)throw Error('Provider unavailable');
  const data=await r.json();const answer=data.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim())throw Error('Model response unavailable');
  return {...briefing,ai:{enabled:true,status:'generated',text:answer.slice(0,3200),notice:'AI commentary may be inaccurate. Verify every claim against the linked official source; not investment advice.'}};
 }catch{
  return {...briefing,ai:{enabled:true,status:'unavailable',notice:'AI commentary could not be produced. Factual source links remain available.'}};
 }
}
