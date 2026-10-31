const origin=process.env.SMOKE_URL||'http://127.0.0.1:3000';
for(const [path,check] of [['/api/health',v=>v.ok===true],['/api/ready',v=>v.ready===true],['/api/capabilities',v=>v.liveTrading===false&&v.liveBankTransfers===false]]){
 const response=await fetch(new URL(path,origin),{signal:AbortSignal.timeout(5000)});
 if(!response.ok||!check(await response.json()))throw Error('Smoke check failed: '+path);
 console.log('PASS',path);
}
