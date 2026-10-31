import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
const bad=(message,status=422)=>Object.assign(Error(message),{status});
function settings(env=process.env){
 const {PLAID_CLIENT_ID,PLAID_SECRET,PLAID_ENV='sandbox',BANK_TOKEN_KEY}=env;
 if(!PLAID_CLIENT_ID||!PLAID_SECRET||!BANK_TOKEN_KEY)throw bad('Banking provider is not configured',503);
 if(!['sandbox','production'].includes(PLAID_ENV))throw bad('Invalid banking provider environment',503);
 if(!/^[a-f0-9]{64}$/i.test(BANK_TOKEN_KEY))throw bad('Bank token encryption key must be 32 bytes of hex',503);
 return {id:PLAID_CLIENT_ID,secret:PLAID_SECRET,env:PLAID_ENV,key:Buffer.from(BANK_TOKEN_KEY,'hex')};
}
export function sealToken(token,keyHex){
 if(typeof token!=='string'||!token)throw bad('Invalid token');
 const key=Buffer.from(keyHex,'hex');if(key.length!==32)throw bad('Invalid key');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
export function openToken(value,keyHex){
 const bytes=Buffer.from(value,'base64'),key=Buffer.from(keyHex,'hex');
 if(key.length!==32||bytes.length<29)throw bad('Invalid sealed token');
 const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
 decipher.setAuthTag(bytes.subarray(12,28));
 return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8');
}
async function plaid(path,body,{fetcher=fetch,env=process.env}={}){
 const c=settings(env);
 // fixed provider origin: users cannot supply arbitrary endpoints.
 const endpoint=c.env==='production'?'https://production.plaid.com':'https://sandbox.plaid.com';
 const res=await fetcher(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:c.id,secret:c.secret,...body}),signal:AbortSignal.timeout(9000)});
 if(!res.ok)throw bad('Bank provider request failed',502);
 return res.json();
}
export async function createLinkToken(userId,options={}){
 const data=await plaid('/link/token/create',{client_name:'MarketreaderPro',language:'en',country_codes:['US'],products:['transactions'],user:{client_user_id:userId}},options);
 if(typeof data.link_token!=='string')throw bad('Bank provider did not return a link token',502);
 return {linkToken:data.link_token,expiration:data.expiration,provider:'plaid',note:'Must be opened with official Plaid Link client.'};
}
export async function exchangeBankToken(db,userId,publicToken,options={}){
 if(typeof publicToken!=='string'||publicToken.length<10||publicToken.length>500)throw bad('Invalid public token');
 const d=await plaid('/item/public_token/exchange',{public_token:publicToken},options);
 if(!d.access_token||!d.item_id)throw bad('Unexpected bank provider response',502);
 const c=settings(options.env??process.env);
 const encrypted=sealToken(d.access_token,c.key.toString('hex'));
 await db.query(`INSERT INTO bank_connections(user_id,item_id,access_ciphertext)
 VALUES($1,$2,$3) ON CONFLICT(user_id,provider,item_id)
 DO UPDATE SET access_ciphertext=EXCLUDED.access_ciphertext,updated_at=now()`,[userId,d.item_id,encrypted]);
 return {connected:true,provider:'plaid',itemId:d.item_id};
}
export async function listBankAccounts(db,userId,options={}){
 const c=settings(options.env??process.env);
 const rows=await db.query('SELECT id,item_id,access_ciphertext FROM bank_connections WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[userId]);
 const connections=[];
 for(const row of rows.rows){
  try{
   const token=openToken(row.access_ciphertext,c.key.toString('hex'));
   const d=await plaid('/accounts/get',{access_token:token},options);
   connections.push({connectionId:row.id,accounts:(d.accounts||[]).map(a=>({id:a.account_id,name:a.name,mask:a.mask,type:a.type,subtype:a.subtype,balances:a.balances}))});
  }catch{connections.push({connectionId:row.id,error:'Account data unavailable'})}
 }
 return {mode:'read-only',connections,source:'Plaid; balances may be delayed'};
}
export async function unlinkBank(db,userId,connectionId,options={}){
 if(typeof connectionId!=='string'||!/^[0-9a-f-]{36}$/i.test(connectionId))throw bad('Invalid connection ID');
 const r=await db.query('SELECT id,access_ciphertext FROM bank_connections WHERE user_id=$1 AND id=$2',[userId,connectionId]);
 if(!r.rows.length)throw bad('Connection not found',404);
 const c=settings(options.env??process.env);
 const token=openToken(r.rows[0].access_ciphertext,c.key.toString('hex'));
 await plaid('/item/remove',{access_token:token},options);
 await db.query('DELETE FROM bank_connections WHERE id=$1 AND user_id=$2',[connectionId,userId]);
 return {disconnected:true};
}
