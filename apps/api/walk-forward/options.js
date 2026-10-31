/**
 * Walk-forward evaluation is intentionally causal and bounded.
 * A hyperparameter search over these same folds would reintroduce selection bias.
 */
export class WalkForwardError extends Error{
 constructor(message){super(message);this.name='WalkForwardError';this.status=422}
}
const fail=x=>{throw new WalkForwardError(x)};
function integer(x,name,min,max,fallback){
 const n=x===undefined?fallback:x;
 if(!Number.isSafeInteger(n)||n<min||n>max)
  fail(name+' must be an integer in ['+min+', '+max+']');
 return n;
}
export function validateWalkForwardOptions(input={},bars){
 if(!input||typeof input!=='object'||Array.isArray(input))
  fail('Walk-forward options must be an object');
 const training=integer(input.trainingBars,'Training bars',35,300,60);
 const testing=integer(input.testingBars,'Testing bars',35,200,40);
 const step=integer(input.stepBars,'Step bars',testing,200,testing);
 const gap=integer(input.purgeGapBars,'Purge gap',0,20,0);
 const maxFolds=integer(input.maxFolds,'Maximum folds',1,10,8);
 const volatilityFloor=typeof input.volatilityFloor==='number'?
  input.volatilityFloor:0.001;
 if(!Number.isFinite(volatilityFloor)||volatilityFloor<0.00001||volatilityFloor>0.1)
  fail('Volatility floor must be between 0.00001 and 0.1');
 if(training+testing+gap>bars)
  fail('Not enough historical bars for training, purge gap, and out-of-sample testing');
 return {
  trainingBars:training,
  testingBars:testing,
  stepBars:step,
  purgeGapBars:gap,
  maxFolds,
  volatilityFloor,
  algorithms:['equal-weight','inverse-volatility','momentum-tilt']
 };
}
export function planFolds(total,options){
 const folds=[];
 for(let trainStart=0;trainStart+options.trainingBars+options.purgeGapBars+
     options.testingBars<=total&&folds.length<options.maxFolds;trainStart+=options.stepBars){
  const trainEnd=trainStart+options.trainingBars;
  const testStart=trainEnd+options.purgeGapBars;
  folds.push({
   fold:folds.length+1,
   trainStart,
   trainEndExclusive:trainEnd,
   purgeStart:trainEnd,
   testStart,
   testEndExclusive:testStart+options.testingBars
  });
 }
 if(!folds.length)fail('No eligible walk-forward folds');
 return folds;
}
