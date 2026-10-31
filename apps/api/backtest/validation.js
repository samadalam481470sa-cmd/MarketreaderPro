/**
 * A backtest only accepts explicitly supplied historical OHLCV price bars.
 * Prediction-market probabilities must not be passed off as executable equity prices.
 */
export class BacktestInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BacktestInputError';
    this.status = 422;
  }
}
export const fail = message => { throw new BacktestInputError(message); };
export const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export function parseTimestamp(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') fail('Bar time must be ISO 8601 or Unix milliseconds');
  const t = typeof raw === 'number' ? raw : Date.parse(DATE_ONLY.test(raw) ? raw + 'T00:00:00Z' : raw);
  if (!Number.isFinite(t) || Math.abs(t) > 8.64e15) fail('Invalid bar timestamp');
  return t;
}
export function validateBars(raw, { minimum = 35, maximum = 700 } = {}) {
  if (!Array.isArray(raw) || raw.length < minimum || raw.length > maximum)
    fail('Provide between ' + minimum + ' and ' + maximum + ' historical OHLCV bars');
  const out = [];
  let prior = -Infinity;
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Each bar must be an OHLCV object');
    const time = parseTimestamp(item.time ?? item.date);
    if (time <= prior) fail('Bars must be strictly increasing with no duplicate dates');
    prior = time;
    const { open, high, low, close } = item;
    if (![open, high, low, close].every(isFiniteNumber)) fail('Open, high, low and close must be finite numbers');
    if (low <= 0 || high > 1e9 || low > Math.min(open, close) ||
        high < Math.max(open, close) || high < low)
      fail('Inconsistent OHLC prices');
    const volume = item.volume ?? null;
    if (volume !== null && (!isFiniteNumber(volume) || volume < 0 || volume > 1e16))
      fail('Volume must be finite, positive or omitted');
    out.push({ time, date: new Date(time).toISOString(), open, high, low, close, volume });
  }
  return out;
}
const allowedStrategies = new Set(['buy-and-hold', 'sma-crossover', 'rsi-reversion', 'momentum']);
function boundedNumber(value, name, low, high, fallback) {
  const v = value === undefined ? fallback : value;
  if (!isFiniteNumber(v) || v < low || v > high) fail(name + ' is outside permitted bounds');
  return v;
}
function integer(value, name, low, high, fallback) {
  const n = boundedNumber(value, name, low, high, fallback);
  if (!Number.isSafeInteger(n)) fail(name + ' must be an integer');
  return n;
}
export function validateOptions(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('Options must be an object');
  const strategy = raw.strategy ?? 'sma-crossover';
  if (!allowedStrategies.has(strategy)) fail('Unsupported strategy');
  const options = {
    strategy,
    initialCash: boundedNumber(raw.initialCash, 'Initial cash', 100, 10_000_000, 10_000),
    feeBps: boundedNumber(raw.feeBps, 'Fee basis points', 0, 100, 10),
    slippageBps: boundedNumber(raw.slippageBps, 'Slippage basis points', 0, 250, 5),
    fixedFee: boundedNumber(raw.fixedFee, 'Fixed transaction fee', 0, 100, 0),
    maxAllocation: boundedNumber(raw.maxAllocation, 'Maximum allocation', 0.05, 1, 0.95),
    fractionalShares: raw.fractionalShares === true,
    periodsPerYear: integer(raw.periodsPerYear, 'Periods per year', 1, 365_000, 252),
    fastPeriod: integer(raw.fastPeriod, 'Fast moving average', 2, 100, 8),
    slowPeriod: integer(raw.slowPeriod, 'Slow moving average', 3, 200, 21),
    rsiPeriod: integer(raw.rsiPeriod, 'RSI lookback', 3, 100, 14),
    oversold: boundedNumber(raw.oversold, 'Oversold RSI', 1, 49, 30),
    overbought: boundedNumber(raw.overbought, 'Overbought RSI', 51, 99, 70),
    momentumLookback: integer(raw.momentumLookback, 'Momentum lookback', 2, 150, 12),
    momentumThreshold: boundedNumber(raw.momentumThreshold, 'Momentum threshold', 0, 0.5, 0.02),
    trailingStopPct: boundedNumber(raw.trailingStopPct, 'Trailing stop', 0, 0.9, 0),
    outputLimit: integer(raw.outputLimit, 'Output points', 20, 500, 150)
  };
  if (options.fastPeriod >= options.slowPeriod) fail('Fast moving average must be shorter than slow');
  if (options.slippageBps + options.feeBps >= 10_000) fail('Trading costs cannot exceed 100%');
  return options;
}
export function validateBacktestInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Request must contain bars and options');
  const bars = validateBars(input.bars);
  const options = validateOptions(input.options);
  const warmup = Math.max(options.slowPeriod, options.rsiPeriod + 1, options.momentumLookback + 1);
  if (options.strategy === 'sma-crossover' && bars.length <= options.slowPeriod + 1)
    fail('Insufficient bars after moving-average warmup');
  if (options.strategy === 'rsi-reversion' && bars.length <= options.rsiPeriod + 2)
    fail('Insufficient bars after RSI warmup');
  if (options.strategy === 'momentum' && bars.length <= options.momentumLookback + 1)
    fail('Insufficient bars after momentum warmup');
  return { bars, options, warmup };
}
