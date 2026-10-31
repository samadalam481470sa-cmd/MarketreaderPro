import {research} from './services.js';
export async function aiResearch(question,{fetcher=fetch,env=process.env}={}){
 if(typeof question!=='string'||question.trim().length<4||question.length>1500)throw Object.assign(Error('Question must be 4–1500 characters'),{status:422});
 const key=env.AI_API_KEY, model=env.AI_MODEL;
 if(!key||!model)return {...research(question),provider:'local-rules',disclaimer:'Educational information, not personalized financial advice.'};
 // Fixed destination prevents users from choosing arbitrary remote endpoints.
 const url='https://api.openai.com/v1/chat/completions';
 const prompt='You provide educational financial research. Do not claim access to real-time prices, private information or live account data. Do not give personalized buy/sell instructions. Clearly mention risks and data limitations. Answer concisely.';
 const res=await fetcher(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:prompt},{role:'user',content:question}],temperature:0.2,max_completion_tokens:450}),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Object.assign(Error('AI provider unavailable'),{status:502});
 const data=await res.json();
 const answer=data.choices?.[0]?.message?.content;
 if(typeof answer!=='string'||!answer.trim())throw Object.assign(Error('Invalid AI provider response'),{status:502});
 return {mode:'model-generated',provider:'openai',answer:answer.slice(0,6000),disclaimer:'Educational research. Independently verify sources, pricing, and suitability.'};
}
