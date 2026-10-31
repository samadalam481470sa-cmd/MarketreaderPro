"""Bounded public endpoint clients. Market metadata is untrusted; only allowlisted fields persist."""
import json
import urllib.request
from urllib.error import URLError

KALSHI = "https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open"
POLYMARKET = "https://gamma-api.polymarket.com/markets?limit=100&active=true&closed=false"
MAX_BYTES = 1_500_000

def retrieve_json(url, opener=urllib.request.urlopen):
    # URLs are constants, not derived from user input.
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "MarketreaderProResearchAgent/0.6"})
    with opener(req, timeout=8) as response:
        raw = response.read(MAX_BYTES+1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Market feed response too large")
        return json.loads(raw)

def _valid_probability(value):
    try:
        number = float(value)
        return number if 0 <= number <= 1 and number == number else None
    except (ValueError, TypeError, OverflowError):
        return None

def parse_kalshi(payload, limit=100):
    rows = []
    for x in payload.get("markets", [])[:limit]:
        if not isinstance(x, dict):
            continue
        market_id, title = x.get("ticker"), x.get("title")
        # Kalshi yes_ask is legacy integer cents; yes_ask_dollars is decimal dollars.
        p = _valid_probability(x.get("yes_ask_dollars"))
        if p is None and isinstance(x.get("yes_ask"), int):
            p = _valid_probability(x["yes_ask"]/100)
        if not isinstance(market_id, str) or not market_id or not isinstance(title, str) or p is None:
            continue
        rows.append({"source":"kalshi","market_id":market_id[:128],"title":title[:500],"probability":p})
    return rows

def parse_polymarket(payload, limit=100):
    rows = []
    if not isinstance(payload, list):
        return rows
    for x in payload[:limit]:
        if not isinstance(x, dict):
            continue
        prices = x.get("outcomePrices")
        labels = x.get("outcomes")
        try:
            if isinstance(prices, str): prices = json.loads(prices)
            if isinstance(labels, str): labels = json.loads(labels)
        except (ValueError, TypeError):
            continue
        # Only treat the outcome explicitly labeled Yes as a yes probability.
        if not isinstance(prices, list) or not isinstance(labels, list) or "Yes" not in labels:
            continue
        index = labels.index("Yes")
        p = _valid_probability(prices[index]) if index < len(prices) else None
        mid, title = x.get("id"), x.get("question")
        if p is None or mid is None or not isinstance(title, str):
            continue
        rows.append({"source":"polymarket","market_id":str(mid)[:128],"title":title[:500],"probability":p})
    return rows

def fetch_all(limit=100, getter=retrieve_json):
    data, errors = [], {}
    for name, url, parser in (("kalshi",KALSHI,parse_kalshi),("polymarket",POLYMARKET,parse_polymarket)):
        try:
            data.extend(parser(getter(url), limit))
        except (ValueError, KeyError, TypeError, OSError, URLError) as exc:
            errors[name] = type(exc).__name__
    return data, errors
