"""Generate human-reviewed code improvement notes. Never mutate tracked code."""
import json
import os
import time
from pathlib import Path
from .feedback import feedback_summary

def proposal_text(db):
    count=db.execute("SELECT COUNT(*) FROM samples").fetchone()[0]
    recent=db.execute("SELECT status,backend,examples,baseline_mse,model_mse,promoted FROM model_runs ORDER BY id DESC LIMIT 1").fetchone()
    failures=db.execute("SELECT COUNT(*) FROM agent_runs WHERE status IN ('failed','partial')").fetchone()[0]
    response=["# MarketreaderPro local improvement proposal",
              "", "Generated from local **public market research** and explicit feedback.",
              "Review all changes manually and run the test suite before modifying code.",
              "**This report never edits repository source files or makes commits.**","",
              "## Evidence",f"- Public data snapshots: {count}",f"- Degraded or failed research runs: {failures}"]
    if recent:
        response.extend([f"- Last model run: {recent[0]} on {recent[1]}, {recent[2]} examples",
                         f"- Baseline MSE: {recent[3]}; candidate MSE: {recent[4]}",
                         f"- Model promoted: {bool(recent[5])}"])
    feedback=feedback_summary(db)
    response.extend(["", "## User feedback",f"- Markets with explicit feedback: {len(feedback)}"])
    response.extend([f"- {x['source']} / {x['marketId']}: {x['helpful']} helpful out of {x['total']}"
                     for x in feedback[:10]])
    response.extend(["","## Suggested development tasks",
       "1. Add richer official-market source timestamps and reliable market close detection.",
       "2. Compare against strictly forward-only historical baselines before promoting models.",
       "3. Add model-drift alerts and market-specific sample-size thresholds.",
       "4. Improve source retry/backoff and ensure API rate limits are respected.",
       "5. Have a developer review proposed changes as a Git pull request with tests.",
       "",
       "No automatic trading, code execution, credential access, or source edits are authorized."])
    return "\n".join(response)+"\n"

def write_proposal(db,directory="research-proposals"):
    dest=Path(directory).resolve()
    dest.mkdir(parents=True,exist_ok=True)
    stamp=time.strftime("%Y%m%d-%H%M%S",time.gmtime())
    name=dest/("proposal-"+stamp+"-"+str(os.getpid())+".md")
    # Create without clobbering any existing proposal.
    with name.open("x",encoding="utf-8") as handle:
        handle.write(proposal_text(db))
    return str(name)
