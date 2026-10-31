# Portfolio Risk Lab (v1.5)

Portfolio Risk Lab is a **read-only statistical research tool** for comparing up to 12 assets using user-provided, date-aligned historical close prices. It does not connect to banking accounts or brokerage execution, does not retrieve paid equities data, and does not place trades.

## Dashboard instructions

1. Start the application and visit **http://localhost:3000**.
2. Open **Portfolio Risk Lab** from the navigation.
3. Upload a CSV with header `date,AAA,BBB` (replace AAA and BBB with actual symbols).
4. Provide 35–500 rows of positive historical adjusted closing prices, on strictly increasing dates.
5. Optionally enter weights such as `AAA:0.6,BBB:0.4`; if omitted, equal weights are used.
6. Select an empirical loss confidence level and annualization frequency.
7. Submit the calculation to view volatility, covariance, correlation, historical loss statistics, individual risk contributions, and hypothetical shocks.

The uploaded data is not verified against an exchange. The user must use data they have a lawful right to process. Prices **must be properly adjusted** for splits, distributions and currency differences where relevant.

## API

`POST /api/portfolio-risk` with a JSON object:

```json
{
  "assets": [
    {
      "symbol": "AAA",
      "weight": 0.6,
      "prices": [
        {"date": "2025-01-02", "close": 100.5},
        {"date": "2025-01-03", "close": 101.2}
      ]
    },
    {
      "symbol": "BBB",
      "weight": 0.4,
      "prices": [
        {"date": "2025-01-02", "close": 70.1},
        {"date": "2025-01-03", "close": 69.8}
      ]
    }
  ],
  "periodsPerYear": 252,
  "confidence": 0.95,
  "scenarios": [
    {"name": "Custom simultaneous shock", "shocks": {"AAA": -0.15, "BBB": 0.05}}
  ]
}
```

This demonstrates the JSON shape only; actual requests require 35–500 aligned timestamps per asset and 2–12 symbols. Weights must be positive and sum to 1.0. User-supplied scenario shocks are limited to a verified symbol and a bounded range.

### Mathematical conventions

- Daily simple return of asset *i* at bar *t*: `close[i,t] / close[i,t-1] - 1`.
- Fixed-mix portfolio return: weighted sum of asset returns, with **daily hypothetical rebalancing**.
- Historical sample covariance uses divisor `n - 1`.
- Risk estimate applies a fixed 15% off-diagonal covariance shrinkage for numerical robustness, retaining marginal sample variances.
- Correlation is the unshrunk sample correlation. When an asset variance is zero, correlation is reported as null instead of a fabricated coefficient.
- Portfolio variance is `w'Σw`; volatility is its square root and annualized by square root of periods per year.
- Fractional risk contribution is `weight[i] * (Σw)[i] / (w'Σw)`. Contributions can be negative for hedging assets.
- The effective asset count is `1 / sum(w[i]^2)`; this is a **weight concentration measure**, not actual factor independence.
- Historical one-bar Value at Risk uses a sample quantile of negative returns; empirical expected shortfall averages the worst observed tail. Both are floored at zero for long-only loss reporting.
- Maximum drawdown is measured on a hypothetical fixed-mix compounded equity path, before fees and taxes.
- Hypothetical scenarios apply additive weighted price shocks and are **not sourced historical crisis replays**.

### Important limitations

This model does **not** support forecasts or probabilities of future portfolio loss. Historical correlations, volatility, VaR and CVaR can be unstable during regime shifts, especially with only tens of daily observations. Data timestamps must align exactly; the system never silently forward-fills missing market days. The result includes a source-unverified disclaimer and explicit compounding assumptions.

The engine assumes daily portfolio rebalancing without fees, market impact, taxes or FX conversion, making results especially unsuitable as a direct realized-performance estimate. **Do not call the outputs live quote prices or personalized investment advice.**

The public endpoint accepts at most 600 KB of JSON and does not store uploaded datasets.

## Verification

```bash
npm install
npm run verify
npm run package:check
```

The engine is covered in `tests/portfolio-risk.test.js`, the uploader in `tests/portfolio-csv.test.js`, and the HTTP integration in `tests/http-portfolio-risk.test.js`.
