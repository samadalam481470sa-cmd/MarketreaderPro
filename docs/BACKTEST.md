# MarketreaderPro historical backtesting engine (v1.4)

This module is a **research-only simulation** for **user-provided historical OHLCV prices**, independent of the live public prediction market feeds. It never places a trade, uploads files to a broker, or downloads a data vendor's equity feed.

## Using the dashboard

1. Install and start MarketreaderPro using [the Quick Start](QUICKSTART.md).
2. Open **http://localhost:3000**, then select **Strategy Backtesting**.
3. Upload your authorized historical CSV (35–700 rows, maximum 160 KB).
4. Choose buy-and-hold, SMA crossover, RSI reversion, or momentum threshold.
5. Adjust initial cash, order fees, execution slippage, moving average windows, annualization, and trailing stop.
6. Select *Calculate historical simulation*. The chart compares the strategy with a next-open buy-and-hold benchmark using the **same data, costs and sizing model**.

The CSV must have these columns (names are case insensitive):

| date | open | high | low | close | volume |
|---|---:|---:|---:|---:|---:|
| ISO date | positive numeric | numeric | numeric | numeric | optional nonnegative |

**No sample/fake live price CSV is included.** Obtain historical OHLCV data from a lawful source, check corporate actions and splits, and confirm the dates are strictly increasing. Prices are **not** implicitly current or verified by MarketreaderPro.

## Programmatic API

```http
POST /api/backtest
Content-Type: application/json
```

```json
{
  "bars": [
    {"date":"2025-01-02","open":101,"high":105,"low":100,"close":103,"volume":10000},
    {"date":"2025-01-03","open":104,"high":106,"low":102,"close":105,"volume":11000}
  ],
  "options": {
    "strategy":"sma-crossover",
    "fastPeriod":8,
    "slowPeriod":21,
    "initialCash":10000,
    "feeBps":10,
    "slippageBps":5,
    "fixedFee":0,
    "maxAllocation":0.95,
    "fractionalShares":false,
    "periodsPerYear":252,
    "trailingStopPct":0
  },
  "stress": {"trials":120,"horizon":60,"blockSize":5,"seed":42}
}
```

The above JSON demonstrates the shape only: **real requests need at least 35 bars**. The request is limited to 160 KB and 700 bars. Strategy parameters are individually bounded.

## Signal and fill timing

The backtester processes one completed OHLCV bar at a time.

1. An existing order generated at the previous close fills at the **current bar's open**, after slippage and fees.
2. The account is marked to market at the **current close**.
3. The strategy calculates its next action using **current and earlier closes only**.
4. If the action is buy or sell, it becomes a pending order for **the following bar's open**.
5. No order executes after the final observation, and none fills at the same close that generated the signal.

**Trailing stops** use observed closes only, with next-bar-open exit. This does not simulate stop-market intrabar fills or opening gaps accurately. The engine is long-only. It disallows negative cash, and whole-share sizing is the default.

## Fees and assumptions

- Basis-point transaction fees and slippage are applied to each executed order.
- Optional fixed fees are included in affordability checks.
- Position value uses the dataset's close, without independently verified bid/ask liquidity.
- Long-only, no leverage or margin borrowing, no borrow costs.
- Cash is assumed to have a zero yield; dividends, splits, distributions and corporate actions must already be adjusted by the supplied dataset.
- Price bars are not checked for exchange halts, venue restrictions or survivorship bias.
- No foreign exchange conversion or tax lots.
- The output's benchmark uses the same next-open fill convention and cost assumptions.

## Risk results

The report includes equity history, simulated orders, trade fees, completed round-trip win statistics, turnover, annualized volatility, maximum drawdown, Sharpe and Sortino estimates, and buy-and-hold excess return. Annualization uses the caller-selected bars-per-year assumption. Null indicates undefined metrics rather than a fabricated numerical value.

The optional **moving-block bootstrap** resamples historical changes and reports descriptive 5th, 25th, 50th, 75th, and 95th percentile outcomes and sampled drawdowns. Resampling **does not yield calibrated forward probabilities**, especially with short, biased or regime-dependent historical records.

## Validation and failure handling

Errors are returned with HTTP 422 for invalid datasets/configuration, HTTP 413 for oversized requests, and HTTP 415 for incorrect content type. CSV parsing occurs locally in the browser. The history is sent only when the user deliberately submits the simulation; the service does not persist it.

The engine is exposed in public research mode but cannot access banking tokens or brokerage connectors. Experimental bank and order execution routes remain gated off in public mode.

## Reproducing tests

```bash
npm install
npm run verify
npm run code:audit
```

See `tests/backtest-engine.test.js`, `tests/csv-parser.test.js`, and `tests/http-backtest.test.js`. The CI workflow verifies them and packages both the backend and CSV upload frontend.
