import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateHoldout,stabilityDiagnostics} from '../apps/api/walk-forward/holdout.js';
import {costSensitivity} from '../apps/api/walk-forward/cost-stress.js';
import {runWalkForward} from '../apps/api/walk-forward/engine.js';
import {validatePortfolio} from '../apps/api/portfolio-risk/validation.js';
const methods=['equal-weight','inverse-volatility','momentum-tilt'];
const fake=(index,returns)=>({
 fold:index,trainEnd:'2025-01-01',firstTestObservation:'2025-02-01',testEnd:'2025-03-01',
 evaluations:Object.fromEntries(methods.map((m,i)=>[m,{
  totalReturn:returns[i],passiveReturn:.02,maxDrawdown:.05,transactionDrag:1,weights:[]
 }]))
});
test('selection uses earlier folds but not the final held-out fold',()=>{
 const first=fake(1,[.10,.05,.02]),second=fake(2,[.10,.06,.03]);
 const final=fake(3,[-.50,1,.99]);
 const r=evaluateHoldout([first,second,final],methods);
 assert.equal(r.selectedMethod,'equal-weight');
 assert.equal(r.holdoutFold,3);
 assert.equal(r.finalHoldout.totalReturn,-.50);
});
test('mutating the final holdout cannot affect the selected method',()=>{
 const a=[fake(1,[.04,.01,.02]),fake(2,[.03,.01,.02]),fake(3,[1,0,0])];
 const b=structuredClone(a);b[2].evaluations['equal-weight'].totalReturn=-1;
 assert.equal(evaluateHoldout(a,methods).selectedMethod,evaluateHoldout(b,methods).selectedMethod);
});
test('one fold does not claim independent holdout evidence',()=>{
 const out=evaluateHoldout([fake(1,[.1,.2,.3])],methods);
 assert.equal(out.status,'insufficient-folds');
 assert.equal(out.selectedMethod,null);
});
test('stability reports worst observed excess returns',()=>{
 const r=stabilityDiagnostics([fake(1,[.1,.03,.02]),fake(2,[-.1,.01,.03])],methods);
 assert.equal(r.methods['equal-weight'].negativeExcessFoldCount,1);
 assert.ok(r.methods['equal-weight'].worstExcessReturn<0);
});
test('real held-out data are re-evaluated at increasing simulated costs',()=>{
 const dates=Array.from({length:165},(_,i)=>new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10));
 const input={assets:[
  {symbol:'AAA',weight:.5,prices:dates.map((date,i)=>({date,close:100+i*.25}))},
  {symbol:'BBB',weight:.5,prices:dates.map((date,i)=>({date,close:70+i*.1}))}
 ],walkForward:{trainingBars:60,testingBars:40,stepBars:40,purgeGapBars:3},
 execution:{feeBps:10,slippageBps:5}};
 const result=runWalkForward(input);
 assert.equal(result.holdout.status,'evaluated');
 const sensitivity=costSensitivity(validatePortfolio(input),result.folds,result.methods,{feeBps:10,slippageBps:5,initialCash:10000,
  rebalanceEvery:21,driftThreshold:.03,fractionalShares:true,fixedFee:0,chartPoints:120,keepTrades:100});
 assert.equal(sensitivity.scenarios.length,3);
 const zero=sensitivity.scenarios[0].methods['equal-weight'].averageOutOfSampleReturn;
 const cost=sensitivity.scenarios[2].methods['equal-weight'].averageOutOfSampleReturn;
 assert.ok(zero>cost);
});
