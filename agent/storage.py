"""WAL-enabled local SQLite store. The desktop agent keeps its own public-data journal."""
import sqlite3
import time
from contextlib import contextmanager

SCHEMA = """
CREATE TABLE IF NOT EXISTS samples(
 source TEXT NOT NULL,
 market_id TEXT NOT NULL,
 title TEXT NOT NULL,
 captured_at INTEGER NOT NULL,
 probability REAL NOT NULL CHECK(probability >= 0 AND probability <= 1),
 PRIMARY KEY (source, market_id, captured_at)
);
CREATE INDEX IF NOT EXISTS samples_recent ON samples(captured_at);
CREATE TABLE IF NOT EXISTS research_signals(
 source TEXT NOT NULL,
 market_id TEXT NOT NULL,
 title TEXT NOT NULL,
 calculated_at INTEGER NOT NULL,
 observations INTEGER NOT NULL,
 latest_probability REAL NOT NULL,
 momentum REAL,
 volatility REAL,
 score REAL,
 backend TEXT NOT NULL,
 PRIMARY KEY (source, market_id)
);
CREATE TABLE IF NOT EXISTS agent_runs(
 run_id INTEGER PRIMARY KEY AUTOINCREMENT,
 started_at INTEGER NOT NULL,
 ended_at INTEGER,
 status TEXT NOT NULL,
 fetched INTEGER NOT NULL DEFAULT 0,
 errors TEXT NOT NULL DEFAULT ''
);
"""

@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=15)
    try:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA busy_timeout=5000")
        db.executescript(SCHEMA)
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def save_samples(db, data, epoch=None):
    epoch = int(epoch if epoch is not None else time.time())
    rows = [(item["source"], item["market_id"], item["title"], epoch, item["probability"]) for item in data]
    db.executemany("""INSERT OR IGNORE INTO samples(source,market_id,title,captured_at,probability)
                      VALUES(?,?,?,?,?)""", rows)
    return len(rows)

def histories(db, max_markets=100, window=48):
    markets = db.execute("""SELECT source,market_id,MAX(captured_at) AS at
       FROM samples GROUP BY source,market_id ORDER BY at DESC LIMIT ?""", (max_markets,)).fetchall()
    result = []
    for source, mid, _ in markets:
        observations = db.execute("""SELECT title,probability FROM samples
          WHERE source=? AND market_id=? ORDER BY captured_at DESC LIMIT ?""",
          (source, mid, window)).fetchall()
        if observations:
            result.append((source, mid, observations[0][0], [row[1] for row in reversed(observations)]))
    return result

def save_signals(db, signals, epoch=None):
    epoch = int(epoch if epoch is not None else time.time())
    db.executemany("""INSERT INTO research_signals(source,market_id,title,calculated_at,observations,latest_probability,momentum,volatility,score,backend)
      VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(source,market_id) DO UPDATE SET
        title=excluded.title,calculated_at=excluded.calculated_at,
        observations=excluded.observations,latest_probability=excluded.latest_probability,
        momentum=excluded.momentum,volatility=excluded.volatility,score=excluded.score,backend=excluded.backend""",
      [(s["source"],s["market_id"],s["title"],epoch,s["observations"],s["latest_probability"],
        s["momentum"],s["volatility"],s["score"],s["backend"]) for s in signals])

def recent_signals(db, limit=20):
    db.row_factory = sqlite3.Row
    return [dict(r) for r in db.execute("""SELECT source,market_id,title,calculated_at,observations,
      latest_probability,momentum,volatility,score,backend FROM research_signals
      ORDER BY score DESC,calculated_at DESC LIMIT ?""",(min(max(int(limit),1),100),))]

def clean_old(db, retention_days=90, epoch=None):
    cutoff = int(epoch if epoch is not None else time.time()) - retention_days*86400
    db.execute("DELETE FROM samples WHERE captured_at < ?", (cutoff,))
    db.execute("DELETE FROM agent_runs WHERE started_at < ?", (cutoff,))
