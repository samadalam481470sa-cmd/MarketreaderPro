/**
 * Bootstrap risk scenarios are empirical re-shufflings of historical changes.
 * They are NOT forecasts or confidence intervals for future returns.
 */
import { BacktestInputError } from './validation.js';
function generator(seed) {
  let x = seed >>> 0 || 0x6a09e667;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function quantile(values, fraction) {
  const i = (values.length - 1) * fraction;
  const low = Math.floor(i), high = Math.ceil(i);
  return values[low] + (values[high] - values[low]) * (i - low);
}
export function bootstrapScenarios(bars, {
  trials = 120, horizon = 60, blockSize = 5, seed = 42
} = {}) {
  if (!Number.isSafeInteger(trials) || trials < 20 || trials > 300)
    throw new BacktestInputError('Trials must be between 20 and 300');
  if (!Number.isSafeInteger(horizon) || horizon < 5 || horizon > 252)
    throw new BacktestInputError('Horizon must be between 5 and 252 bars');
  if (!Number.isSafeInteger(blockSize) || blockSize < 1 || blockSize > 25)
    throw new BacktestInputError('Block size must be between 1 and 25');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new BacktestInputError('Seed must be a nonnegative 32-bit integer');
  const changes=[];
  for(let i=1;i<bars.length;i++){
    if(bars[i-1].close <= 0)throw new BacktestInputError('Invalid historical price');
    changes.push(bars[i].close/bars[i-1].close - 1);
  }
  if(changes.length<Math.max(20,blockSize+2))
    throw new BacktestInputError('Insufficient history for bootstrap');
  const random=generator(seed);
  const results=[];
  const startingPrice=bars.at(-1).close;
  for(let trial=0;trial<trials;trial++){
    let value=startingPrice;
    let high=value,maxDrawdown=0,at=0;
    while(at<horizon){
      const start=Math.floor(random()*changes.length);
      for(let step=0;step<blockSize&&at<horizon;step++){
        value*=1+changes[(start+step)%changes.length];
        high=Math.max(high,value);
        maxDrawdown=Math.max(maxDrawdown,high>0?(high-value)/high:0);
        at++;
      }
    }
    results.push({endingPrice:value,endingReturn:value/startingPrice-1,maxDrawdown});
  }
  const sortedReturns=results.map(x=>x.endingReturn).sort((a,b)=>a-b);
  const sortedDrawdowns=results.map(x=>x.maxDrawdown).sort((a,b)=>a-b);
  return {
    method:'historical-moving-block-bootstrap',
    trials,horizonBars:horizon,blockSize,seed,
    historicalObservations:bars.length,
    startReferencePrice:startingPrice,
    simulatedReturnQuantiles:{
      p05:quantile(sortedReturns,.05),
      p25:quantile(sortedReturns,.25),
      median:quantile(sortedReturns,.5),
      p75:quantile(sortedReturns,.75),
      p95:quantile(sortedReturns,.95)
    },
    simulatedDrawdownQuantiles:{median:quantile(sortedDrawdowns,.5),p95:quantile(sortedDrawdowns,.95)},
    fractionWithNegativeEndingReturn:results.filter(x=>x.endingReturn<0).length/trials,
    caution:'Resampling the past is not a prediction, a calibrated probability of loss, or a confidence interval. Regime shifts and tail events may be absent.'
  };
}
