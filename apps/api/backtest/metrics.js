import { isFiniteNumber } from './validation.js';
export function safe(value) { return isFiniteNumber(value) ? value : null; }
export function summarizeEquity(equity, initialCash, periodsPerYear = 252) {
  const values = equity.map(x => x.equity);
  const returns = [];
  let high = initialCash, maxDrawdown = 0, worst = 0, underwater = 0, currentUnderwater = 0;
  for (let i = 0; i < values.length; i++) {
    const previous = i ? values[i - 1] : initialCash;
    const r = previous > 0 ? values[i] / previous - 1 : 0;
    returns.push(r);
    high = Math.max(high, values[i]);
    const drop = high > 0 ? (high - values[i]) / high : 0;
    maxDrawdown = Math.max(drop, maxDrawdown);
    worst = Math.min(worst, r);
    currentUnderwater = drop > 0 ? currentUnderwater + 1 : 0;
    underwater = Math.max(underwater, currentUnderwater);
  }
  const n = returns.length;
  const mean = n ? returns.reduce((a,b) => a + b,0) / n : 0;
  const variance = n ? returns.reduce((a,b) => a + (b-mean)**2,0) / n : 0;
  const volatility = Math.sqrt(Math.max(0,variance));
  const negatives = returns.filter(x => x < 0);
  const downside = negatives.length ? Math.sqrt(negatives.reduce((a,b)=>a+b*b,0) / n) : 0;
  const finalEquity = values.at(-1) ?? initialCash;
  const totalReturn = initialCash > 0 ? finalEquity / initialCash - 1 : null;
  const growth = finalEquity > 0 && n > 0 ? (finalEquity / initialCash) ** (periodsPerYear / n) - 1 : null;
  const sharpe = volatility > 1e-12 ? Math.sqrt(periodsPerYear)*mean/volatility : null;
  const sortino = downside > 1e-12 ? Math.sqrt(periodsPerYear)*mean/downside : null;
  return { initialCash,finalEquity,totalReturn,annualizedReturn:safe(growth),
    annualizedVolatility:volatility*Math.sqrt(periodsPerYear),
    maxDrawdown,maxUnderwaterBars:underwater,worstBarReturn:worst,
    sharpe:safe(sharpe),sortino:safe(sortino),
    calmar:maxDrawdown>1e-12&&growth!==null?safe(growth/maxDrawdown):null,
    annualizationAssumption:'Bar frequency assumed to be '+periodsPerYear+' bars per year. Risk-free rate is assumed zero.' };
}
export function summarizeTrades(trades, initialCash) {
  const exits = trades.filter(x => x.side === 'sell');
  const wins = exits.filter(x => x.realizedPnl > 0);
  const losses = exits.filter(x => x.realizedPnl < 0);
  const positive = wins.reduce((a,b)=>a+b.realizedPnl,0);
  const negative = -losses.reduce((a,b)=>a+b.realizedPnl,0);
  const dollars = trades.reduce((a,b)=>a+b.notional,0);
  return {orders:trades.length,roundTrips:exits.length,wins:wins.length,losses:losses.length,
    winRate:exits.length?wins.length/exits.length:null,
    totalTradingNotional:dollars,turnoverRelativeToInitialCash:initialCash>0?dollars/initialCash:null,
    realizedPnl:exits.reduce((a,b)=>a+b.realizedPnl,0),
    averageClosedTradePnl:exits.length?exits.reduce((a,b)=>a+b.realizedPnl,0)/exits.length:null,
    profitFactor:negative>0?positive/negative:null,
    fees:trades.reduce((a,b)=>a+b.fee,0),
    slippageCost:trades.reduce((a,b)=>a+b.slippageCost,0),
    caution:'Open positions are marked to market but excluded from closed round-trip win statistics.' };
}
export function downsampleEquity(data, maxPoints=150) {
  if (data.length<=maxPoints)return data;
  // Preserve endpoints and spikes by bucketing + alternating local minimum/maximum.
  const output=[data[0]];
  const interior=maxPoints-2;
  const bins=Math.max(1,Math.floor(interior/2));
  const size=(data.length-2)/bins;
  for(let i=0;i<bins;i++){
    const start=1+Math.floor(i*size),end=1+Math.floor((i+1)*size);
    const bucket=data.slice(start,Math.max(start+1,end));
    if(!bucket.length)continue;
    let low=bucket[0],high=bucket[0];
    for(const point of bucket){
      if(point.equity<low.equity)low=point;
      if(point.equity>high.equity)high=point;
    }
    if(low.index<high.index){output.push(low);if(high.index!==low.index)output.push(high)}
    else {output.push(high);if(low.index!==high.index)output.push(low)}
  }
  output.push(data.at(-1));
  return output.slice(0,maxPoints);
}
