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
export async function readJson(req,maxBytes=8192){const type=req.headers['content-type']||'';if(!/^application\/json(?:\s*;|\s*$)/i.test(type)){const e=Error('Content-Type must be application/json');e.status=415;throw e}const length=Number(req.headers['content-length']||0);if(length>maxBytes){const e=Error('Payload too large');e.status=413;throw e}let data='';let count=0;for await(const chunk of req){count+=chunk.length;if(count>maxBytes){const e=Error('Payload too large');e.status=413;throw e}data+=chunk.toString('utf8')}try{return JSON.parse(data)}catch{const e=Error('Invalid JSON');e.status=400;throw e}}
export function safeIp(req){return req.socket.remoteAddress||'unknown'} // Do not trust X-Forwarded-For unless a trusted proxy is configured.
