"""Scheduled opt-in local research loop; never executes financial orders."""
import argparse
import json
import logging
import signal
import threading
import time
from .config import Settings
from .sources import fetch_all
from .signals import compute_signals
from .storage import connect,save_samples,histories,save_signals,recent_signals,clean_old

log = logging.getLogger("marketreader.agent")

def research_cycle(settings, getter=None, now=None):
    epoch = int(time.time() if now is None else now)
    fetch_kwargs={"limit":settings.max_markets}
    if getter is not None: fetch_kwargs["getter"]=getter
    samples, errors=fetch_all(**fetch_kwargs)
    with connect(settings.db_path) as db:
        cursor=db.execute("INSERT INTO agent_runs(started_at,status) VALUES(?,?)",(epoch,"running"))
        run_id=cursor.lastrowid
        try:
            save_samples(db,samples,epoch)
            rows=histories(db,settings.max_markets*2)
            signals,backend=compute_signals(rows,settings.gpu_mode)
            save_signals(db,signals,epoch)
            clean_old(db,settings.retention_days,epoch)
            status="partial" if errors else ("ok" if samples else "empty")
            db.execute("UPDATE agent_runs SET ended_at=?,status=?,fetched=?,errors=? WHERE run_id=?",
                       (int(time.time()),status,len(samples),json.dumps(errors),run_id))
            return {"status":status,"fetched":len(samples),"signals":len(signals),
                    "backend":backend,"errors":errors,"capturedAt":epoch}
        except Exception:
            db.execute("UPDATE agent_runs SET ended_at=?,status=? WHERE run_id=?",(int(time.time()),"failed",run_id))
            raise

def main(argv=None):
    parser=argparse.ArgumentParser(description="MarketreaderPro opt-in local research agent")
    parser.add_argument("command",choices=["once","run","status"])
    args=parser.parse_args(argv)
    settings=Settings.from_env()
    logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
    if args.command=="status":
        with connect(settings.db_path) as db:
            print(json.dumps({"recentSignals":recent_signals(db),"recentRuns":db.execute(
                "SELECT started_at,ended_at,status,fetched,errors FROM agent_runs ORDER BY run_id DESC LIMIT 5").fetchall()}))
        return
    if args.command=="once":
        print(json.dumps(research_cycle(settings)))
        return
    stop=threading.Event()
    def stopping(signum,frame):
        stop.set()
    signal.signal(signal.SIGTERM,stopping)
    signal.signal(signal.SIGINT,stopping)
    log.info("Research agent started; interval=%ss, gpu=%s; signals are descriptive only",
             settings.interval_seconds,settings.gpu_mode)
    while not stop.is_set():
        try:
            log.info("Cycle %s",json.dumps(research_cycle(settings)))
        except Exception as exc:
            log.error("Cycle failed: %s",type(exc).__name__)
        stop.wait(settings.interval_seconds)

if __name__=="__main__":
    main()
