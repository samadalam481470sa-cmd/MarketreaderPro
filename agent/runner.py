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
from .learning import train, save_result, trained_model
from .feedback import record_feedback, personalized_signals
from .proposals import write_proposal

log = logging.getLogger("marketreader.agent")

def research_cycle(settings, getter=None, now=None, learn=False):
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
            learning=None
            if learn:
                learning=train(db,settings.gpu_mode)
                save_result(db,learning)
            status="partial" if errors else ("ok" if samples else "empty")
            db.execute("UPDATE agent_runs SET ended_at=?,status=?,fetched=?,errors=? WHERE run_id=?",
                       (int(time.time()),status,len(samples),json.dumps(errors),run_id))
            return {"status":status,"fetched":len(samples),"signals":len(signals),
                    "backend":backend,"errors":errors,"capturedAt":epoch,"learning":learning}
        except Exception:
            db.execute("UPDATE agent_runs SET ended_at=?,status=? WHERE run_id=?",(int(time.time()),"failed",run_id))
            raise

def main(argv=None):
    parser=argparse.ArgumentParser(description="MarketreaderPro opt-in local research agent")
    parser.add_argument("command",choices=["once","run","status","train","feedback","propose"])
    parser.add_argument("args",nargs="*")
    parser.add_argument("--learn",action="store_true",help="Opt into model training every research cycle")
    args=parser.parse_args(argv)
    settings=Settings.from_env()
    logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)s %(message)s")
    if args.command=="feedback":
        if len(args.args)!=3:parser.error("feedback requires SOURCE MARKET_ID helpful|not-helpful")
        with connect(settings.db_path) as db:record_feedback(db,*args.args)
        print(json.dumps({"recorded":True,"source":args.args[0],"marketId":args.args[1]}))
        return
    if args.command=="propose":
        with connect(settings.db_path) as db:filename=write_proposal(db)
        print(json.dumps({"proposal":filename,"sourceChanges":False}))
        return
    if args.command=="train":
        with connect(settings.db_path) as db:
            result=train(db,settings.gpu_mode)
            save_result(db,result)
        print(json.dumps(result))
        return
    if args.command=="status":
        with connect(settings.db_path) as db:
            print(json.dumps({"recentSignals":personalized_signals(db),"trainedModel":trained_model(db),"recentRuns":db.execute(
                "SELECT started_at,ended_at,status,fetched,errors FROM agent_runs ORDER BY run_id DESC LIMIT 5").fetchall()}))
        return
    if args.command=="once":
        print(json.dumps(research_cycle(settings,learn=args.learn)))
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
            log.info("Cycle %s",json.dumps(research_cycle(settings,learn=args.learn)))
        except Exception as exc:
            log.error("Cycle failed: %s",type(exc).__name__)
        stop.wait(settings.interval_seconds)

if __name__=="__main__":
    main()
