# Research Lab (v1.3)

The MarketreaderPro Research Lab provides transparent statistical analysis of saved historical public prediction-market probabilities.

```
GET /api/research-lab?source=kalshi&id=MARKET_ID&window=10&evaluation=true
```

It requires PostgreSQL and an existing sequence of observed values for the specified provider ID. No fabricated values are inserted when samples are missing.

Calculations include bounded rolling averages and volatility bands, maximum peak-to-trough probability movement, unusual single-observation changes relative to the preceding historical window, and a walk-forward comparison of a simple trend model against the no-change baseline.

**No lookahead**: the walk-forward model only uses values observed before each next-snapshot comparison. Evaluations describe probability changes, not profits. Prediction-market probabilities are not necessarily executable prices, and fees, settlement, liquidity, and spread are absent.

Callers must not interpret any result as a trading signal. The service has no brokerage/order endpoint and cannot make trades. Inputs are validated for ordered timestamps and bounds, and result sizes are limited. More observations are necessary for meaningful comparisons.
