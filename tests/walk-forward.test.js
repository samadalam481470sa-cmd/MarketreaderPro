import test from 'node:test';
import assert from 'node:assert/strict';
import {runWalkForward} from '../apps/api/walk-forward/engine.js';
import {planFolds,validateWalkForwardOptions} from '../apps/api/walk-forward/options.js';
import {calculateTrainingWeights} from '../apps/api/walk-forward/weights.js';

const day=i=>new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
const sample=()=>({
 assets:[
  {symbol:'AAA',weight:.5,prices:Array.from({length:165},(_,i)=>({date:day(i),close:100*(1+i*.002+Math.sin(i/7)*.03)}))},
  {symbol:'BBB',weight:.5,prices:Array.from({length:165},(_,i)=>({date:day(i),close:70*(1+i*.001+Math.sin(i/5)*.06)}))}
 ],
 walkForward:{trainingBars:60,testingBars:40,stepBars:40,purgeGapBars:3},
 execution:{initialCash:10000,rebalanceEvery:10,feeBps:5,slippageBps:3}
});
test('chronological folds never overlap in their test periods',()=>{
 const opts=validateWalkForwardOptions({trainingBars:60,testingBars:40,stepBars:40,purgeGapBars:3},165);
 const folds=planFolds(165,opts);
 assert.equal(folds.length,2);
 assert.equal(folds[0].testStart,63);
 assert.ok(folds[0].testEndExclusive<=folds[1].testStart);
});
test('invalid overlapping test windows are rejected',()=>{
 assert.throws(()=>validateWalkForwardOptions({trainingBars:60,testingBars:40,stepBars:10},165),/Step bars/);
 assert.throws(()=>validateWalkForwardOptions({trainingBars:120,testingBars:90,purgeGapBars:10},165),/Not enough/);
});
test('weight methods use positive normalized weights and bound concentration',()=>{
 const train=sample().assets.map(a=>({...a,prices:a.prices.slice(0,60)}));
 for(const method of ['equal-weight','inverse-volatility','momentum-tilt']){
  const w=calculateTrainingWeights(train,method);
  assert.equal(w.length,2);
  assert.ok(w.every(x=>x>0&&x<=.800000001));
  assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-9);
 }
});
test('out-of-sample evaluation reports folds, costs and causal dates',()=>{
 const r=runWalkForward(sample());
 assert.equal(r.folds.length,2);
 assert.equal(r.methods.length,3);
 assert.match(r.interpretation,/not compounded/);
 for(const f of r.folds){
  assert.ok(Date.parse(f.trainEnd)<Date.parse(f.firstTestObservation));
  for(const method of r.methods){
   assert.ok(Number.isFinite(f.evaluations[method].totalReturn));
   assert.ok(f.evaluations[method].transactionDrag>=0);
  }
 }
});
test('changing a future test observation cannot affect preceding train weights',()=>{
 const first=sample(),altered=structuredClone(first);
 altered.assets[0].prices[85].close*=1.3;
 const a=runWalkForward(first),b=runWalkForward(altered);
 for(const method of a.methods)
  assert.deepEqual(a.folds[0].evaluations[method].weights,b.folds[0].evaluations[method].weights);
});
test('changing post-test prices leaves earlier folds unchanged',()=>{
 const first=sample(),altered=structuredClone(first);
 altered.assets[1].prices[130].close*=1.4;
 const a=runWalkForward(first),b=runWalkForward(altered);
 assert.deepEqual(a.folds[0],b.folds[0]);
});
test('purge-window prices cannot change training weights',()=>{
 const first=sample(),altered=structuredClone(first);
 altered.assets[0].prices[61].close*=1.4;
 const a=runWalkForward(first),b=runWalkForward(altered);
 for(const method of a.methods)
  assert.deepEqual(a.folds[0].evaluations[method].weights,b.folds[0].evaluations[method].weights);
});
test('fees reduce fixed-method holdings relative to frictionless run',()=>{
 const a=sample(),b=sample();
 a.execution.feeBps=0;a.execution.slippageBps=0;
 b.execution.feeBps=90;b.execution.slippageBps=100;
 const x=runWalkForward(a),y=runWalkForward(b);
 assert.ok(x.folds[0].evaluations['equal-weight'].finalEquity>
  y.folds[0].evaluations['equal-weight'].finalEquity);
});
