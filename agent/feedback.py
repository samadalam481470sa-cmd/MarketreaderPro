"""Explicit local user feedback. Never collects browser telemetry or private accounts."""
import time

def record_feedback(db,source,market_id,helpful):
    if source not in ("kalshi","polymarket") or not isinstance(market_id,str) or len(market_id)>128 or not market_id:
        raise ValueError("Invalid market")
    if helpful not in ("helpful","not-helpful"):
        raise ValueError("Feedback must be helpful or not-helpful")
    db.execute("INSERT INTO user_feedback(source,market_id,rating,recorded_at) VALUES(?,?,?,?)",
               (source,market_id,helpful,int(time.time())))

def feedback_summary(db):
    rows=db.execute("SELECT source,market_id,SUM(CASE WHEN rating='helpful' THEN 1 ELSE 0 END) AS positive,COUNT(*) AS total FROM user_feedback GROUP BY source,market_id ORDER BY total DESC LIMIT 100").fetchall()
    return [{"source":r[0],"marketId":r[1],"helpful":r[2],"total":r[3]} for r in rows]

def personalized_signals(db,limit=20):
    # User-driven research ordering, separate from the calibrated market model.
    db.row_factory=__import__("sqlite3").Row
    rows=db.execute("""SELECT s.*,COALESCE(f.useful,0) AS useful,COALESCE(f.total,0) AS feedback_count
      FROM research_signals s LEFT JOIN (
        SELECT source,market_id,SUM(CASE WHEN rating='helpful' THEN 1 ELSE -1 END) AS useful,
        COUNT(*) AS total FROM user_feedback GROUP BY source,market_id
      ) f ON s.source=f.source AND s.market_id=f.market_id
      ORDER BY (s.score+0.1*COALESCE(f.useful,0)/(1.0+COALESCE(f.total,0))) DESC LIMIT ?""",(limit,)).fetchall()
    return [dict(r) for r in rows]
