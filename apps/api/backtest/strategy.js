/**
 * Generate a desired exposure after observing a complete bar.
 * A trade based on this signal is not filled until the NEXT bar's open.
 */
import { BacktestInputError } from './validation.js';
const HOLD = 'hold', BUY = 'buy', SELL = 'sell';
export function signalAt(index, bars, indicators, options, { isHolding = false } = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= bars.length)
    throw new BacktestInputError('Signal index out of bounds');
  const strategy = options.strategy;
  if (strategy === 'buy-and-hold') return index === 0 && !isHolding ? BUY : HOLD;
  if (strategy === 'sma-crossover') {
    const fast = indicators.smaFast[index], slow = indicators.smaSlow[index];
    if (fast === null || slow === null) return HOLD;
    if (!isHolding && fast > slow) return BUY;
    if (isHolding && fast < slow) return SELL;
    return HOLD;
  }
  if (strategy === 'rsi-reversion') {
    const current = indicators.rsi[index];
    if (current === null) return HOLD;
    if (!isHolding && current <= options.oversold) return BUY;
    if (isHolding && current >= options.overbought) return SELL;
    return HOLD;
  }
  if (strategy === 'momentum') {
    const current = indicators.momentum[index];
    if (current === null) return HOLD;
    if (!isHolding && current > options.momentumThreshold) return BUY;
    if (isHolding && current < -options.momentumThreshold) return SELL;
    return HOLD;
  }
  throw new BacktestInputError('Unsupported signal strategy');
}
export function describeStrategy(options) {
  const descriptions = {
    'buy-and-hold': 'Buy once at the second observation open; mark to market through the final close.',
    'sma-crossover': 'When short-window mean crosses the long-window mean in direction, target full or zero exposure.',
    'rsi-reversion': 'Enter after low RSI; exit after elevated RSI. No short positions.',
    momentum: 'Enter after positive lookback return exceeds threshold; exit after sufficiently negative momentum.'
  };
  return { name: options.strategy, description: descriptions[options.strategy],
    execution: 'Signals use completed close values; fills only occur at subsequent open, with configured costs.',
    risks: ['Historical simulation does not prove future results', 'Missing dividends and corporate actions',
      'No intraday order book, liquidity constraints, or validated live brokerage data'] };
}
