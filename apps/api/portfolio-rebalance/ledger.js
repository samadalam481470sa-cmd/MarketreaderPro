import {RebalanceInputError} from './options.js';

const EPS=1e-8;
const round=(value,digits=8)=>Number(value.toFixed(digits));

/**
 * A deterministic simulated cash ledger.
 * Transactions always fill at the observed NEXT close, with conservative
 * explicit costs and no margin, shorting or dividend assumptions.
 */
export function createLedger(portfolio,options){
 const state={
  cash:options.initialCash,
  shares:Array(portfolio.assets.length).fill(0),
  initialCash:options.initialCash,
  fees:0,
  slippageCost:0,
  totalNotional:0,
  orders:0,
  ignoredOrders:0,
  turnover:0,
  trades:[],
  costBySymbol:Object.fromEntries(portfolio.assets.map(a=>[a.symbol,0]))
 };
 const rate=options.feeBps/10000;
 const slip=options.slippageBps/10000;
 const symbols=portfolio.assets.map(a=>a.symbol);
 const fraction=options.fractionalShares;
 function roundShares(shares){
  if(!Number.isFinite(shares)||shares<=0)return 0;
  // Always round DOWN; an epsilon added here could create a share that cash cannot fund.
  return fraction?Math.floor(shares*1e6)/1e6:Math.floor(shares);
 }
 function mark(prices){
  const assetValues=prices.map((price,i)=>state.shares[i]*price);
  return {cash:state.cash,assetValues,
   equity:state.cash+assetValues.reduce((a,b)=>a+b,0)};
 }
 function record(index,side,quantity,price,fillPrice,fee,reason){
  const i=Number(index);
  const notional=quantity*fillPrice;
  const cost=Math.abs(fillPrice-price)*quantity;
  const item={
   symbol:symbols[i],side,quantity:round(quantity,6),
   referenceClose:round(price,6),fillPrice:round(fillPrice,6),
   fee:round(fee,6),slippageCost:round(cost,6),notional:round(notional,6),reason
  };
  state.orders++;
  state.fees+=fee;state.slippageCost+=cost;
  state.totalNotional+=notional;state.costBySymbol[symbols[i]]+=fee+cost;
  state.trades.push(item);
  return item;
 }
 function sell(index,desiredQuantity,price,reason){
  const qty=roundShares(Math.min(state.shares[index],desiredQuantity));
  if(qty<=0){state.ignoredOrders++;return null}
  const fillPrice=price*(1-slip),notional=qty*fillPrice;
  const fee=notional*rate+options.fixedFee;
  if(notional<fee-EPS){state.ignoredOrders++;return null}
  state.cash+=notional-fee;
  state.shares[index]-=qty;
  if(Math.abs(state.shares[index])<EPS)state.shares[index]=0;
  return record(index,'sell',qty,price,fillPrice,fee,reason);
 }
 function buy(index,wantedQuantity,price,reason){
  const fillPrice=price*(1+slip);
  const maxAffordable=(state.cash-options.fixedFee)/(fillPrice*(1+rate));
  const qty=roundShares(Math.min(wantedQuantity,Math.max(0,maxAffordable)));
  if(qty<=0){state.ignoredOrders++;return null}
  const notional=qty*fillPrice,fee=notional*rate+options.fixedFee;
  const total=notional+fee;
  if(total>state.cash+EPS)throw new RebalanceInputError('Buy exceeded available simulated cash');
  state.cash=Math.max(0,state.cash-total);
  state.shares[index]+=qty;
  return record(index,'buy',qty,price,fillPrice,fee,reason);
 }
 function buyInitial(prices,reason='initial-allocation'){
  // Spend from pre-allocated cash budgets, not a fictional fee-free full investment.
  for(let i=0;i<portfolio.assets.length;i++){
    const budget=options.initialCash*portfolio.weights[i];
    const fillPrice=prices[i]*(1+slip);
    const shares=roundShares(Math.max(0,budget-options.fixedFee)/(fillPrice*(1+rate)));
    buy(i,shares,prices[i],reason);
  }
 }
 function rebalance(prices,reason='scheduled-rebalance'){
  const before=mark(prices);
  const equity=before.equity;
  if(equity<=EPS)throw new RebalanceInputError('Portfolio equity was exhausted');
  // Sell first to free cash, then buy. Desired target values use the current
  // NEXT close; the decision to rebalance was made from PRIOR close.
  for(let i=0;i<prices.length;i++){
    const target=equity*portfolio.weights[i];
    const existing=state.shares[i]*prices[i];
    if(existing>target+EPS)sell(i,(existing-target)/prices[i],prices[i],reason);
  }
  for(let i=0;i<prices.length;i++){
    const afterSell=mark(prices);
    const target=afterSell.equity*portfolio.weights[i];
    const existing=state.shares[i]*prices[i];
    if(existing<target-EPS)buy(i,(target-existing)/prices[i],prices[i],reason);
  }
 }
 function assertInvariants(prices){
  if(!Number.isFinite(state.cash)||state.cash< -EPS)throw new RebalanceInputError('Negative or invalid cash balance');
  if(state.shares.some(s=>!Number.isFinite(s)||s< -EPS))throw new RebalanceInputError('Negative or invalid long-only shares');
  const snapshot=mark(prices);
  if(!Number.isFinite(snapshot.equity)||snapshot.equity< -EPS)throw new RebalanceInputError('Invalid portfolio mark-to-market');
  return snapshot;
 }
 return {state,mark,buyInitial,rebalance,assertInvariants};
}
