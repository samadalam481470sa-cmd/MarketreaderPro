/**
 * Numeric indicators implemented as incremental computations.
 * All values for index i depend only on indices <= i.
 */
import { BacktestInputError, isFiniteNumber } from './validation.js';
function assertSeries(values) {
  if (!Array.isArray(values) || !values.length || !values.every(isFiniteNumber))
    throw new BacktestInputError('Indicators require finite numeric observations');
}
function checkPeriod(period) {
  if (!Number.isInteger(period) || period < 2 || period > 1000)
    throw new BacktestInputError('Invalid indicator period');
}
export function simpleMovingAverage(values, period) {
  assertSeries(values); checkPeriod(period);
  let rolling = 0;
  return values.map((value, i) => {
    rolling += value;
    if (i >= period) rolling -= values[i - period];
    return i >= period - 1 ? rolling / period : null;
  });
}
export function exponentialMovingAverage(values, period) {
  assertSeries(values); checkPeriod(period);
  const alpha = 2 / (period + 1);
  let seed = 0, ema = null;
  return values.map((value, i) => {
    if (i < period) seed += value;
    if (i === period - 1) ema = seed / period;
    else if (i > period - 1) ema = alpha * value + (1 - alpha) * ema;
    return i < period - 1 ? null : ema;
  });
}
export function relativeStrengthIndex(values, period) {
  assertSeries(values); checkPeriod(period);
  let gains = 0, losses = 0, averageGain = 0, averageLoss = 0;
  const out = Array(values.length).fill(null);
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    if (i <= period) {
      gains += up; losses += down;
      if (i !== period) continue;
      averageGain = gains / period;
      averageLoss = losses / period;
    } else {
      averageGain = (averageGain * (period - 1) + up) / period;
      averageLoss = (averageLoss * (period - 1) + down) / period;
    }
    if (averageLoss === 0) out[i] = averageGain === 0 ? 50 : 100;
    else out[i] = 100 - 100 / (1 + averageGain / averageLoss);
  }
  return out;
}
export function momentum(values, period) {
  assertSeries(values); checkPeriod(period);
  return values.map((value, i) =>
    i < period || values[i - period] <= 0 ? null : value / values[i - period] - 1);
}
export function annualizedHistoricalVolatility(values, periodsPerYear = 252, lookback = 20) {
  assertSeries(values); checkPeriod(lookback);
  if (!isFiniteNumber(periodsPerYear) || periodsPerYear <= 0) throw new BacktestInputError('Invalid annualization');
  const returns = [null];
  for (let i = 1; i < values.length; i++)
    returns.push(values[i - 1] > 0 ? Math.log(values[i] / values[i - 1]) : null);
  const out = Array(values.length).fill(null);
  let sum = 0, sumSq = 0;
  for (let i = 1; i < values.length; i++) {
    const r = returns[i]; if (r === null) continue;
    sum += r; sumSq += r * r;
    if (i > lookback) { sum -= returns[i - lookback]; sumSq -= returns[i - lookback] ** 2; }
    if (i >= lookback) {
      const mean = sum / lookback;
      out[i] = Math.sqrt(Math.max(0, sumSq / lookback - mean ** 2) * periodsPerYear);
    }
  }
  return out;
}
export function averageTrueRange(bars, period = 14) {
  checkPeriod(period);
  const ranges = bars.map((bar, i) =>
    Math.max(bar.high - bar.low,
      i ? Math.abs(bar.high - bars[i - 1].close) : 0,
      i ? Math.abs(bar.low - bars[i - 1].close) : 0));
  let total = 0, previous = null;
  return ranges.map((r, i) => {
    if (i < period) total += r;
    if (i === period - 1) previous = total / period;
    else if (i > period - 1) previous = (previous * (period - 1) + r) / period;
    return i >= period - 1 ? previous : null;
  });
}
export function makeIndicators(bars, options) {
  const close = bars.map(b => b.close);
  return {
    close,
    smaFast: simpleMovingAverage(close, options.fastPeriod),
    smaSlow: simpleMovingAverage(close, options.slowPeriod),
    emaFast: exponentialMovingAverage(close, options.fastPeriod),
    rsi: relativeStrengthIndex(close, options.rsiPeriod),
    momentum: momentum(close, options.momentumLookback),
    atr: averageTrueRange(bars, Math.min(options.rsiPeriod, bars.length)),
    volatility: annualizedHistoricalVolatility(close, options.periodsPerYear, Math.min(20, bars.length - 1))
  };
}
