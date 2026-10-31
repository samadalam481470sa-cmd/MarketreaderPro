// Dedicated, opt-in process for a persistent host. No unattended local machine installation.
import {getPool,closePool} from '../apps/api/database.js';
import {ingestIntelligence,localDate} from '../apps/api/intelligence.js';
const ZONE='America/Chicago';
const hour=Number(process.env.MRP_BRIEFING_HOUR??7);
const minute=Number(process.env.MRP_BRIEFING_MINUTE??0);
if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)throw Error('Invalid scheduled time');
const components=now=>new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
export function timeParts(now=new Date()){
 const p=Object.fromEntries(components(now).map(x=>[x.type,x.value]));
 return {hour:Number(p.hour),minute:Number(p.minute),date:localDate(now)};
}
export function due(now,lastDate,atHour=7,atMinute=0){
 const p=timeParts(now);
 return p.date!==lastDate&&(p.hour>atHour||(p.hour===atHour&&p.minute>=atMinute));
}
const run=async()=>{
 const db=await getPool();
 const today=localDate();
 const existing=await db.query('SELECT briefing_date FROM daily_briefings WHERE briefing_date=$1',[today]);
 if(existing.rowCount)return {skipped:'already-generated'};
 const secCiks=(process.env.MRP_SEC_CIKS||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(secCiks.length>50||secCiks.some(x=>!/^\d{1,10}$/.test(x)))throw Error('Invalid SEC CIK configuration');
 // Exclusive transaction lock is session scoped and released on disconnect.
 const client=await db.connect();
 let locked=false;
 try{
  const result=await client.query('SELECT pg_try_advisory_lock(417832,2049) AS acquired');
  locked=result.rows[0]?.acquired===true;
  if(!locked)return {skipped:'another-worker-running'};
  const fresh=await db.query('SELECT briefing_date FROM daily_briefings WHERE briefing_date=$1',[today]);
  if(fresh.rowCount)return {skipped:'already-generated'};
  return await ingestIntelligence(db,{secCiks});
 }finally{if(locked)await client.query('SELECT pg_advisory_unlock(417832,2049)');client.release()}
};
async function main(){
 console.log(JSON.stringify({event:'scheduler-start',zone:ZONE,hour,minute}));
 let stopped=false, running=false, lastAttempt=null;
 const end=()=>{stopped=true};
 process.on('SIGINT',end);process.on('SIGTERM',end);
 while(!stopped){
  const now=new Date();
  if(!running&&due(now,lastAttempt,hour,minute)){
   running=true;lastAttempt=localDate(now);
   try{console.log(JSON.stringify({event:'morning-intelligence',result:await run()}))}
   catch(e){console.error(JSON.stringify({event:'morning-error',type:e.name}));lastAttempt=null}
   finally{running=false}
  }
  // Check once per minute; avoids both high CPU polling and local wake timers.
  await new Promise(resolve=>setTimeout(resolve,60000));
 }
 await closePool();
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).pathname===new URL(import.meta.url).pathname){
 main().catch(e=>{console.error(JSON.stringify({event:'fatal',type:e.name}));process.exitCode=1});
}
