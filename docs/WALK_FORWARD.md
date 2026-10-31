# Multi-asset causal walk-forward evaluation

The walk-forward engine operates on user-provided aligned historical close observations. It **does not** download current prices or generate any trades.

## Methods

Three fixed long-only target-weight methods are evaluated on identically dated folds:

1. Equal weights.
2. Inverse training-window volatility with a positive floor and concentration protection.
3. Momentum-tilted weights based only on the training-window start and end.

Weights are computed using **only the training period**. The algorithm does not see held-out prices before weight selection. A configurable purge gap excludes the bars between training and testing, and test windows never overlap.

## Train/test timing

With 60 training, 40 testing, 40 step, and 3 purged bars:

- Fold 1 trains on indices 0–59, excludes 60–62, tests on indices 63–102.
- Fold 2 trains on indices 40–99, excludes 100–102, tests on indices 103–142.

The test portfolios begin at the first out-of-sample close with independent initial cash and simulated fees. Subsequent rebalancing follows the existing one-close-delayed signal convention.

Returns from folds are **not compounded across overlapping/incomplete capital histories**. The report uses arithmetic fold averages; it is not an executable continuous portfolio track record.

## API

`POST /api/walk-forward`, JSON limit 600 KB:

```json
{
  "assets": [
    {"symbol":"AAA","weight":0.5,"prices":[{"date":"2025-01-02","close":100}]},
    {"symbol":"BBB","weight":0.5,"prices":[{"date":"2025-01-02","close":70}]}
  ],
  "walkForward":{"trainingBars":60,"testingBars":40,"stepBars":40,"purgeGapBars":3},
  "execution":{"feeBps":10,"slippageBps":5,"rebalanceEvery":21,"initialCash":10000}
}
```

This sample illustrates the schema only; the actual request needs enough observations for the selected training and testing windows (at least 75 total bars with default settings, more if purged).

Each fold includes train/test dates and per-method weights, transaction drag and results. Reported rankings are descriptive; **choosing a winner from the same test folds creates model-selection bias**. Evaluate any chosen method on a later untouched set.

## Caveats

Out-of-sample performance does not guarantee future returns. Data can exhibit survivorship and lookahead bias from asset universe selection, corporate actions, or vendor revisions. Simulated next-close transactions are not authenticated executable quotes. The tool cannot submit orders and is not financial advice.

The interface reuses the multi-asset historical CSV parser in Portfolio Risk Lab. Upload a lawful historical close CSV and select **Walk-forward Lab**.
