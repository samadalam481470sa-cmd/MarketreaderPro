import { validateBacktestInput } from './validation.js';
import { simulate } from './engine.js';
import { describeStrategy } from './strategy.js';
import { bootstrapScenarios } from './stress.js';

/**
 * Public research endpoint: never takes custody of funds or places real orders.
 * All bars arrive directly from the caller, without asserting a verified market source.
 */
export function runBacktest(payload) {
  const { bars, options } = validateBacktestInput(payload);
  const strategy = simulate(bars, options);
  const hold = options.strategy === 'buy-and-hold'
    ? strategy : simulate(bars, options, { strategy: 'buy-and-hold' });
  const activeReturn = strategy.equitySummary.totalReturn;
  const benchmarkReturn = hold.equitySummary.totalReturn;
  const stressOptions = payload.stress;
  const stress = stressOptions === undefined || stressOptions === false ? null
    : bootstrapScenarios(bars, stressOptions === true ? {} : stressOptions);
  return {
    mode:'historical-simulation',
    source:'User-supplied price bars — not independently authenticated',
    disclaimer:'No financial advice, no live prices, no brokerage execution. Historical backtests have selection, lookahead and overfitting risks.',
    observations:bars.length,
    interval:{
      first:bars[0].date,
      last:bars.at(-1).date
    },
    strategy:describeStrategy(options),
    strategyResult:strategy,
    benchmark:{
      name:'next-open-buy-and-hold',
      equitySummary:hold.equitySummary,
      tradeSummary:hold.tradeSummary,
      equityCurve:hold.equityCurve
    },
    comparison:{
      excessTotalReturn:activeReturn-benchmarkReturn,
      strategyMaxDrawdown:strategy.equitySummary.maxDrawdown,
      benchmarkMaxDrawdown:hold.equitySummary.maxDrawdown
    },
    stress
  };
}
