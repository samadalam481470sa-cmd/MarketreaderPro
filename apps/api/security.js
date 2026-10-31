import {randomUUID} from 'node:crypto';
export const SECURITY_HEADERS=Object.freeze({
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; upgrade-insecure-requests"
});
export function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...SECURITY_HEADERS,...headers});res.end(JSON.stringify(data))}
export function requestId(){return randomUUID()}
export function createLimiter({limit=90,windowMs=60000,maxClients=10000}={}){const clients=new Map();return {allow(key,now=Date.now()){let b=clients.get(key);if(!b||now-b.since>=windowMs){b={since:now,count:0};clients.set(key,b)}b.count++;if(clients.size>maxClients){for(const [k,v] of clients){if(now-v.since>=windowMs)clients.delete(k)}if(clients.size>maxClients)clients.delete(clients.keys().next().value)}return {allowed:b.count<=limit,retryAfter:Math.max(1,Math.ceil((windowMs-(now-b.since))/1000))}},size(){return clients.size}}}
export async function readJson(req,maxBytes=8192){
  const type=req.headers['content-type']||'';
  if(!/^application\/json(?:\s*;|\s*$)/i.test(type)){
    const e=Error('Content-Type must be application/json');e.status=415;throw e;
  }
  const announced=req.headers['content-length'];
  if(announced!==undefined){
    const length=Number(announced);
    if(!Number.isSafeInteger(length)||length<0){
      const e=Error('Invalid Content-Length');e.status=400;throw e;
    }
    if(length>maxBytes){const e=Error('Payload too large');e.status=413;throw e;}
  }
  const parts=[];let bytes=0;
  for await(const chunk of req){
    const part=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    bytes+=part.length;
    if(bytes>maxBytes){const e=Error('Payload too large');e.status=413;throw e;}
    parts.push(part);
  }
  let data;
  try{data=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts,bytes));}
  catch{const e=Error('Body must be valid UTF-8');e.status=400;throw e;}
  try{return JSON.parse(data)}
  catch{const e=Error('Invalid JSON');e.status=400;throw e;}
}
export function safeIp(req){return req.socket.remoteAddress||'unknown'} // Do not trust X-Forwarded-For unless a trusted proxy is configured.
