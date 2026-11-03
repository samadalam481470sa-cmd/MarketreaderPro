import test from 'node:test';
import assert from 'node:assert/strict';
import {createLimiter,SECURITY_HEADERS} from '../apps/api/security.js';
import {scanText} from '../scripts/security-check.js';
import {loadMarkets} from '../apps/api/markets.js';
test('rate limit resets after window',()=>{const l=createLimiter({limit:2,windowMs:1000});assert.equal(l.allow('a',0).allowed,true);assert.equal(l.allow('a',1).allowed,true);assert.equal(l.allow('a',2).allowed,false);assert.equal(l.allow('a',1000).allowed,true)});
test('separate IP buckets',()=>{const l=createLimiter({limit:1});assert.equal(l.allow('a').allowed,true);assert.equal(l.allow('b').allowed,true);assert.equal(l.allow('a').allowed,false)});
test('market sources fail independently',async()=>{const fake=async url=>{if(url.includes('kalshi'))throw Error('offline');return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify([{id:'1',question:'Sample market',outcomePrices:'[0.5,0.5]'}])}};const result=await loadMarkets({fetcher:fake});assert.equal(result.availability.kalshi,'rejected');assert.equal(result.availability.polymarket,'fulfilled');assert.equal(result.polymarket[0].title,'Sample market')});
test('market source strips unexpected properties',async()=>{const fake=async url=>({ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(url.includes('kalshi')?{markets:[{ticker:'ABC',title:'Title',yes_ask:3,secret:'token'}]}:[])});const d=await loadMarkets({fetcher:fake});assert.equal(d.kalshi[0].secret,undefined)});
test('security headers block framing, sniffing and unsafe content',()=>{
 const required=['Content-Security-Policy','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Cross-Origin-Resource-Policy','Cross-Origin-Opener-Policy','Strict-Transport-Security','X-Permitted-Cross-Domain-Policies'];
 for(const header of required)assert.ok(SECURITY_HEADERS[header],'missing '+header);
 const csp=SECURITY_HEADERS['Content-Security-Policy'];
 for(const directive of ["default-src 'self'","base-uri 'none'","object-src 'none'","frame-ancestors 'none'","form-action 'self'","script-src 'self'"])assert.ok(csp.includes(directive),'missing '+directive);
 assert.ok(!csp.includes("'unsafe-inline'")&&!csp.includes("'unsafe-eval'"),'CSP must not allow inline or eval scripts');
});
test('credential scanner detects real secrets',()=>{
 const aws='AKIA'+'ABCDEFGHIJKLMNOP';
 assert.equal(scanText(`const key="${aws}";`).some(f=>f.rule==='aws-access-key'),true);
 assert.equal(scanText('-----BEGIN RSA PRIVATE KEY-----').some(f=>f.rule==='private-key'),true); // security-check:ignore fixture
 assert.equal(scanText('const t="ghp_'+'a'.repeat(36)+'";').some(f=>f.rule==='github-token'),true);
 assert.equal(scanText('DATABASE_URL=postgres://marketreader:'+'hunter2planned'+'@db:5432/app').some(f=>f.rule==='credentialed-database-url'),true); // security-check:ignore fixture
});
test('credential scanner ignores documented placeholders',()=>{
 assert.equal(scanText('postgres://marketreader:local-password@localhost:5432/marketreader').length,0);
 assert.equal(scanText('DATABASE_URL=postgres://user:YOUR_PASSWORD@host/db').length,0);
 assert.equal(scanText('SECRET_KEY=placeholder-value').length,0);
});
