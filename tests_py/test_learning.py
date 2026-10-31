import tempfile
import unittest
from pathlib import Path
from agent.storage import connect,save_samples
from agent.learning import training_examples,train,save_result,trained_model,predict_next_change
from agent.feedback import record_feedback,feedback_summary,personalized_signals
from agent.proposals import proposal_text,write_proposal

class LearningTests(unittest.TestCase):
    def populated(self,db):
        for idx in range(100):
            p=max(0.05,min(0.95,0.4+idx*0.002+0.008*((idx%5)-2)))
            save_samples(db,[dict(source="kalshi",market_id="MARKET-1",title="Sample",probability=p)],1000000+300*idx)

    def test_features_have_no_future_leakage(self):
        with tempfile.TemporaryDirectory() as td:
            with connect(str(Path(td)/"market.db")) as db:
                self.populated(db)
                x=training_examples(db)
                self.assertGreater(len(x),50)
                self.assertEqual(len(x[0][1]),4)
                self.assertEqual(x[0][0],1000000+600)
    def test_training_is_opt_in_and_bounded(self):
        with tempfile.TemporaryDirectory() as td:
            with connect(str(Path(td)/"market.db")) as db:
                self.populated(db)
                result=train(db,mode="cpu")
                self.assertEqual(result["status"],"evaluated")
                self.assertLessEqual(result["examples"],2500)
                save_result(db,result)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM model_runs").fetchone()[0],1)
                model=trained_model(db)
                if model:
                    value=predict_next_change(model,[0.3,0.4,0.5])
                    self.assertLessEqual(abs(value),1)
    def test_minimum_training_data(self):
        with tempfile.TemporaryDirectory() as td:
            with connect(str(Path(td)/"db.sqlite")) as db:
                self.assertEqual(train(db,mode="cpu")["status"],"insufficient-history")
    def test_feedback_is_explicit(self):
        with tempfile.TemporaryDirectory() as td:
            with connect(str(Path(td)/"db.sqlite")) as db:
                record_feedback(db,"kalshi","ABC","helpful")
                record_feedback(db,"kalshi","ABC","not-helpful")
                summary=feedback_summary(db)
                self.assertEqual(summary[0]["total"],2)
                self.assertEqual(summary[0]["helpful"],1)
                self.assertIn("Suggested development tasks",proposal_text(db))
                result=write_proposal(db,str(Path(td)/"notes"))
                self.assertTrue(Path(result).exists())
                self.assertNotIn("os.system",Path(result).read_text())
    def test_reject_feedback_for_unrelated_inputs(self):
        with tempfile.TemporaryDirectory() as td:
            with connect(str(Path(td)/"db.sqlite")) as db:
                with self.assertRaises(ValueError):record_feedback(db,"my-bank","1","helpful")

if __name__=="__main__":unittest.main()
