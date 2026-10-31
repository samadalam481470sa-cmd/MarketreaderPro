# Local GPU research companion (opt-in)

This companion is **independent of the hosted banking app**, stores only *public* market observations in a local SQLite file, and never accesses bank account data, private keys, credentials, wallet addresses or brokerage trading endpoints.

## Requirements
- Python 3.10 or newer. Standard library only for CPU mode.
- Optional supported GPU and locally installed PyTorch with CUDA or Apple Metal (MPS).
- Internet access to public Kalshi and Polymarket market APIs.
- The computer must be powered on and able to execute processes. A truly sleeping or powered-off machine **cannot** keep researching on its local GPU.

## Quick start

```bash
# Clone repository, then from repository root:
python3 -m unittest discover -s tests_py -v
MRP_GPU=cpu python3 -m agent once
python3 -m agent status

# Repeated research while computer remains awake:
MRP_RESEARCH_INTERVAL=300 MRP_GPU=auto python3 -m agent run
```

Optional GPU: install a **platform-supported** [PyTorch](https://pytorch.org/get-started/locally/) build. Confirm your GPU availability with `python -c "import torch; print(torch.cuda.is_available(), torch.backends.mps.is_available())"`. The agent automatically prefers CUDA then MPS, otherwise CPU. `MRP_GPU=cpu` avoids importing PyTorch.

## What it does
1. Fetches bounded public market snapshots at a configurable minimum 60-second cadence (default: 300 seconds).
2. Validates Kalshi quotes and Polymarket binary Yes outcome labels before treating values as probabilities.
3. Stores historical snapshots in SQLite WAL mode with no private customer data.
4. Computes latest price, probability momentum, root-mean-square delta volatility and a descriptive score.
5. Uses PyTorch tensor operations on CUDA/Metal to accelerate the **batch numerical stage**. HTTP fetching and persistence run on CPU.
6. Retains 90 days by default; use `MRP_RETENTION_DAYS` to adjust.
7. Logs each research cycle and supports CLI status queries.

**Scores are not predictions or trade advice**; they do not account for settlement risk, market efficiency, fees, spread or liquidity, and small sample counts can be misleading. No automatic orders are executed.

## When the lid is closed or the screen is off
Turning the screen off does not necessarily suspend computing, but **sleep mode suspends GPU work**. You may configure the operating system to keep working while the display is off, subject to its power and battery settings. Launch as a user-level service/Task Scheduler job to auto-restart on login or wake, only with user permission. The `run` command catches up with the next cycle when the computer resumes. No wake timers, sleep prevention or hidden persistence are installed.

## Privacy and resource controls
- Agent is OFF until explicitly started. No startup services are installed.
- `MRP_RESEARCH_INTERVAL` 60–86400 seconds; default 300.
- `MRP_GPU` auto / cpu / cuda / mps.
- `MRP_RESEARCH_DB` local SQLite file path, default `research-agent.sqlite3`.
- `MRP_MARKET_LIMIT` 1–500 per provider (upstream result endpoint currently requests 100).
- `MRP_RETENTION_DAYS` 1–3650, default 90.
- To stop: Ctrl+C or stop the user-owned service. Delete local SQLite file only if you want to erase the locally accumulated public market history.

This is a real standalone research companion; it is **not yet a desktop GUI, autonomous code-writing agent, OS-integrated sleep scheduler or complete 50,000-line system**.

## Opt-in learning engine (v0.7)

The learning engine is **disabled by default**. It learns a small linear model of the *next observed change in implied probability* using historical PUBLIC market snapshots. This is an experimental supervised baseline, not a frontier LLM, not a profitable trading model, and not an agent that learns programming by itself.

```bash
# One training pass on your existing local market history:
MRP_GPU=auto python3 -m agent train

# Keep collecting snapshots and train after each cycle:
MRP_GPU=auto python3 -m agent run --learn

# Explicit feedback on a market's research usefulness:
python3 -m agent feedback kalshi MARKET-ID helpful
python3 -m agent feedback kalshi MARKET-ID not-helpful

# Produce a reviewable improvement plan WITHOUT changing source files:
python3 -m agent propose
```

The model constructs features from *past* snapshots and holds out the latest 20% of examples for evaluation. It promotes new weights only if validation mean-squared error improves by at least 1% over a no-change baseline. Model weights, evaluation records, and explicit market feedback are stored in the local SQLite file. Feedback adjusts which signals appear first in `status`, not financial returns.

PyTorch CUDA/MPS is used for GPU training when present. Small datasets often run more efficiently on CPU. Running `--learn` continuously does **not** guarantee improvement; insufficient data, overfitting, and distribution shifts are significant risks.

### Code self-improvement safety boundary
`python3 -m agent propose` generates a Markdown review proposal under `research-proposals/`. It does not execute generated code, edit tracked files, push to GitHub, install OS background jobs or bypass tests. User/developer approval remains necessary for applying any code changes. True sleep stops GPU processing; automatic resume requires a user-configured OS service.
