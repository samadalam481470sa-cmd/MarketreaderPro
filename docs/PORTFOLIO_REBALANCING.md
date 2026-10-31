# Portfolio Rebalancing Lab (v1.6)

## Scope and data

A deterministic long-only multi-asset allocation backtester operating on **user-supplied historical closing prices**, not live exchange orders. It does not fetch equities from a licensed vendor or connect to a brokerage. All uploaded prices must be authenticated by the user if accuracy matters.

The UI reuses the aligned multi-asset CSV parser from Portfolio Risk Lab.

- Columns: `date,AAA,BBB` (2–12 assets).
- Observations: 35–500 rows, ascending unique dates, exactly aligned across assets.
- Each price must be a finite positive number, and each target weight must be a positive finite fraction totaling 1.
- Default weighting: equal weights if the user does not specify weights.
- Optional weights: `AAA:0.6,BBB:0.4`.
- No synthetic price generation or automatic missing-value imputation.

## Using the app

Start MarketreaderPro, visit `http://localhost:3000`, and select **Rebalancing Lab**.

Upload the historical CSV, set target weights and cash, then configure:
- **Rebalance every N bars** (default 21); observation count, not calendar days.
- **Drift threshold** (default 3% percentage-point deviation from target).
- Fees (basis points), spread/slippage (basis points), optional fixed fee per trade.
- Fractional shares on/off, annualization periods per year.

Press **Run rebalancing simulation** to receive the historical equity chart, cost comparison against passive buy-and-hold, final allocation table, trade ledger, turnover and risk estimates.

## API

`POST /api/portfolio-rebalance`, JSON, maximum 600 KB.

```json
{
  "assets": [
    {"symbol":"AAA","weight":0.6,"prices":[{"date":"2025-01-02","close":100}]},
    {"symbol":"BBB","weight":0.4,"prices":[{"date":"2025-01-02","close":80}]}
  ],
  "periodsPerYear":252,
  "execution":{
    "initialCash":10000,
    "rebalanceEvery":21,
    "driftThreshold":0.03,
    "feeBps":10,
    "slippageBps":5,
    "fixedFee":0,
    "fractionalShares":true
  }
}
```

The JSON above illustrates the input structure **only**. Real requests must contain at least 35 aligned observations for each asset.

## Simulation and no-lookahead convention

1. Initial purchases occur at the first supplied closing observation with simulated slippage and transaction costs.
2. Each later completed close is marked to market using the positions that were held during that observation.
3. At the end of a completed bar, if the configured calendar-of-bars interval is due, the historical target-weight drift is measured. A rebalance signal is recorded only if the configured threshold is exceeded.
4. A recorded signal is executed at the **next** historical closing observation, with sell orders preceding buy orders. Cash, fractional shares and fees constrain each execution.
5. After transaction fills, the next close is used to mark the portfolio and another signal may be generated for a later observation.
6. No signal is filled after the last available bar. The benchmark starts at the same first close and retains its holdings without rebalancing.

**A next-close assumption does not imply an actual exchange close price could have been achieved.** There is no order book, volume participation, close auction, settlement processing, or live brokerage interface.

## Quantities and outputs

- Equity: cash plus mark-to-market holdings at observed closes.
- Turnover multiple: gross traded notional divided by initial cash.
- Transaction drag: simulated fees plus modeled slippage relative to reference closes.
- Return, annualized volatility, peak-to-trough drawdown and historical Sharpe/Sortino estimates.
- Final cash, shares and asset weights; recent simulated order ledger.
- An identical-fee buy-and-hold benchmark, sampled chart points, and difference in observed cumulative returns.

This model does **not** incorporate taxes, dividends, splits, inflation, FX conversions, investment cash flows, interest on idle cash, or borrowing. Price histories should already be adjusted for relevant corporate actions. Repeatedly trying thresholds on the same history causes backtest overfitting; use independent out-of-sample periods and licensed price sources.

## Verification

```bash
npm install
npm run verify
npm run package:check
```

The CI suite covers the cost-aware cash ledger, portfolio limits, no-lookahead signal timing, zero-cost baselines, historical input validation, the API endpoint and bundled static frontend files.

This is financial research software and **not personalized investment advice**.
