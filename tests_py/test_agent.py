import tempfile
import unittest
from pathlib import Path
from agent.config import Settings
from agent.sources import parse_kalshi,parse_polymarket,fetch_all
from agent.signals import compute_signals
from agent.runner import research_cycle
from agent.storage import connect,recent_signals

class AgentTests(unittest.TestCase):
    def test_parsers_reject_unknown_probability(self):
        self.assertEqual(parse_kalshi({"markets":[{"ticker":"T","title":"test","yes_ask":40}]} )[0]["probability"],0.4)
        self.assertEqual(parse_kalshi({"markets":[{"ticker":"T","title":"test","yes_ask":400}]}),[])
        markets=[{"id":"1","question":"Will it rain?","outcomes":'["No","Yes"]',"outcomePrices":'["0.2","0.8"]'}]
        self.assertAlmostEqual(parse_polymarket(markets)[0]["probability"],0.8)
    def test_cpu_signals(self):
        rows=[("kalshi","id","Title",[0.2,0.3,0.5]),("polymarket","2","Other",[0.6])]
        result,backend=compute_signals(rows,"cpu")
        self.assertEqual(backend,"cpu")
        self.assertAlmostEqual(result[0]["momentum"],0.3)
        self.assertEqual(result[1]["score"],0)
    def test_cycle_persists_and_tracks_history(self):
        with tempfile.TemporaryDirectory() as td:
            settings=Settings(interval_seconds=60,db_path=str(Path(td)/"history.sqlite"),gpu_mode="cpu")
            def getter(url):
                if "kalshi" in url:
                    return {"markets":[{"ticker":"ABC","title":"Example","yes_ask":40}]}
                return []
            r=research_cycle(settings,getter=getter,now=1000000)
            self.assertEqual(r["fetched"],1)
            self.assertEqual(r["backend"],"cpu")
            with connect(settings.db_path) as db:
                self.assertEqual(len(recent_signals(db)),1)
            self.assertEqual(research_cycle(settings,getter=getter,now=1000300)["status"],"ok")
    def test_upstream_errors_isolated(self):
        def getter(url):
            if "kalshi" in url: raise OSError("offline")
            return [{"id":"5","question":"Yes?","outcomes":'["Yes","No"]',"outcomePrices":'["0.7","0.3"]'}]
        samples,errors=fetch_all(getter=getter)
        self.assertEqual(len(samples),1)
        self.assertIn("kalshi",errors)
    def test_invalid_settings(self):
        from unittest.mock import patch
        with patch.dict("os.environ",{"MRP_RESEARCH_INTERVAL":"5"}):
            with self.assertRaises(ValueError):Settings.from_env()

if __name__=="__main__":unittest.main()
