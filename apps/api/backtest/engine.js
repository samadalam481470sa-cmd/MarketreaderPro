import { BacktestInputError } from './validation.js';
import { makeIndicators } from './indicators.js';
import { signalAt } from './strategy.js';
import { summarizeEquity, summarizeTrades, downsampleEquity } from './metrics.js';

const EPSILON = 1e-7;
function round(n, decimals = 6) {
  return Number(n.toFixed(decimals));
}
function sharesAffordable(budget, price, feeRate, fixedFee, fractional) {
  if (price <= 0 || budget <= fixedFee) return 0;
  const raw = (budget - fixedFee) / (price * (1 + feeRate));
  const count = fractional ? Math.floor(raw * 1e6) / 1e6 : Math.floor(raw);
  return count > 0 && Number.isFinite(count) ? count : 0;
}
export function simulate(bars, options, { strategy = options.strategy } = {}) {
  const settings = { ...options, strategy };
  const indicators = makeIndicators(bars, settings);
  const feeRate = settings.feeBps / 10000;
  const slipRate = settings.slippageBps / 10000;
  const cashInitial = settings.initialCash;
  let cash = cashInitial;
  let quantity = 0;
  let pending = null;
  let peakClose = null;
  let entryCost = 0;
  let entryTime = null;
  let entryPrice = 0;
  let executedOrders = 0;
  let ignoredSignals = 0;
  let missedFills = 0;
  let signals = 0;
  let exposureBars = 0;
  const trades = [];
  const curve = [];
  const events = [];

  function execute(order, bar, index) {
    const buy = order === 'buy';
    if (buy && quantity > EPSILON) { ignoredSignals++; return; }
    if (!buy && quantity <= EPSILON) { ignoredSignals++; return; }
    const marketPrice = bar.open;
    const fillPrice = marketPrice * (buy ? 1 + slipRate : 1 - slipRate);
    if (fillPrice <= EPSILON) {
      missedFills++;
      return;
    }
    const notionalBudget = cash * settings.maxAllocation;
    const fillQuantity = buy
      ? sharesAffordable(notionalBudget, fillPrice, feeRate, settings.fixedFee, settings.fractionalShares)
      : quantity;
    if (fillQuantity <= EPSILON) {
      missedFills++;
      return;
    }
    const notional = fillQuantity * fillPrice;
    const fee = notional * feeRate + settings.fixedFee;
    if (buy && notional + fee > cash + EPSILON) {
      missedFills++;
      return;
    }
    const change = buy ? -(notional + fee) : notional - fee;
    cash += change;
    if (Math.abs(cash) < EPSILON) cash = 0;
    if (cash < -EPSILON) throw new BacktestInputError('Simulation invariant violated: negative cash');
    const costAtEntry = entryCost;
    const profit = buy ? null : notional - fee - costAtEntry;
    const record = {
      index,
      at: bar.date,
      signalAfter: order.signalAt ?? null,
      side: order,
      quantity: round(fillQuantity),
      referenceOpen: round(marketPrice),
      fillPrice: round(fillPrice),
      notional: round(notional),
      fee: round(fee),
      slippageCost: round(Math.abs(fillPrice - marketPrice) * fillQuantity),
      realizedPnl: profit === null ? null : round(profit),
      holdingBars: buy ? null : index - entryTime,
      cashAfter: round(cash)
    };
    trades.push(record);
    executedOrders++;
    if (buy) {
      quantity = fillQuantity;
      entryCost = notional + fee;
      entryTime = index;
      entryPrice = fillPrice;
      peakClose = Math.max(bar.open, bar.close);
    } else {
      quantity = 0;
      entryCost = 0;
      entryTime = null;
      entryPrice = 0;
      peakClose = null;
    }
  }

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (pending) {
      execute(pending, bar, i);
      pending = null;
    }

    // Closing prices are observable only after the bar ends.
    const equity = cash + quantity * bar.close;
    if (!Number.isFinite(equity) || equity < -EPSILON)
      throw new BacktestInputError('Non-finite simulated equity');
    if (quantity > EPSILON) {
      exposureBars++;
      peakClose = Math.max(peakClose ?? bar.close, bar.close);
    }
    curve.push({
      index: i,
      at: bar.date,
      equity: round(equity),
      cash: round(cash),
      exposureValue: round(quantity * bar.close),
      positionShares: round(quantity),
      close: bar.close
    });

    if (i === bars.length - 1) continue; // Never fill at same-bar close or past the dataset.

    let decision = signalAt(i, bars, indicators, settings, { isHolding: quantity > EPSILON });

    // Optional close-of-bar trailing stop. Executes NEXT open, never an imagined intrabar fill.
    if (quantity > EPSILON && settings.trailingStopPct > 0 &&
        bar.close <= peakClose * (1 - settings.trailingStopPct))
      decision = 'sell';

    if (decision !== 'hold') {
      pending = decision;
      signals++;
      events.push({
        after: bar.date,
        signal: decision,
        evaluatedAtClose: bar.close,
        reason: decision === 'sell' && settings.trailingStopPct > 0 &&
          quantity > EPSILON && bar.close <= peakClose * (1 - settings.trailingStopPct)
          ? 'trailing-stop' : strategy,
        nextPossibleFill: bars[i + 1].date
      });
    }
  }

  const equitySummary = summarizeEquity(curve, cashInitial, settings.periodsPerYear);
  const tradeSummary = summarizeTrades(trades, cashInitial);
  return {
    settings,
    equitySummary,
    tradeSummary,
    equityCurve: downsampleEquity(curve, settings.outputLimit),
    trades: trades.slice(-150),
    recentSignals: events.slice(-80),
    position: { shares: round(quantity), costBasis: quantity ? round(entryCost) : null,
      averageEntryPrice: quantity ? round(entryPrice) : null,
      markedAtClose: bars.at(-1).close },
    diagnostic: { signals, executedOrders, ignoredSignals, missedFills,
      barsWithExposure: exposureBars, exposureFraction: exposureBars / bars.length,
      datasetStart: bars[0].date, datasetEnd: bars.at(-1).date,
      lastBarNoFill: true },
    warning: 'Simulated fills use next OHLCV open plus configured costs. Execution, spreads, borrow, dividends, corporate actions, and live liquidity are not verified.'
  };
}
