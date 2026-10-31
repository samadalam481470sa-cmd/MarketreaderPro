"""Opt-in local research agent settings. Never read bank or brokerage secrets."""
from dataclasses import dataclass
import os

@dataclass(frozen=True)
class Settings:
    interval_seconds: int = 300
    db_path: str = "research-agent.sqlite3"
    gpu_mode: str = "auto"
    max_markets: int = 100
    retention_days: int = 90

    @classmethod
    def from_env(cls):
        interval = int(os.getenv("MRP_RESEARCH_INTERVAL", "300"))
        gpu_mode = os.getenv("MRP_GPU", "auto").lower()
        limit = int(os.getenv("MRP_MARKET_LIMIT", "100"))
        retention = int(os.getenv("MRP_RETENTION_DAYS", "90"))
        if interval < 60 or interval > 86400:
            raise ValueError("MRP_RESEARCH_INTERVAL must be between 60 and 86400")
        if gpu_mode not in ("auto", "cpu", "cuda", "mps"):
            raise ValueError("MRP_GPU must be auto, cpu, cuda, or mps")
        if limit < 1 or limit > 500:
            raise ValueError("MRP_MARKET_LIMIT must be between 1 and 500")
        if retention < 1 or retention > 3650:
            raise ValueError("MRP_RETENTION_DAYS must be between 1 and 3650")
        return cls(interval, os.getenv("MRP_RESEARCH_DB", "research-agent.sqlite3"), gpu_mode, limit, retention)
