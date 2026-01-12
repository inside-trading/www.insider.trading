#!/usr/bin/env python3
"""
Price Data Integration Script
Fetches real-time and historical prices from:
- TwelveData API: Stocks, ETFs, Commodities
- CoinGecko API: Cryptocurrencies

Usage:
    python price_fetcher.py --help
    python price_fetcher.py quotes --all
    python price_fetcher.py quotes --stocks
    python price_fetcher.py quotes --crypto
    python price_fetcher.py history BTC --days 30
"""

import os
import sys
import json
import time
import logging
import argparse
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, asdict
from pathlib import Path

try:
    import requests
except ImportError:
    print("Error: 'requests' package not installed. Run: pip install requests")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

@dataclass
class Config:
    """Configuration for price fetcher."""
    twelvedata_api_key: str = ""
    cache_dir: str = ".price_cache"
    cache_ttl_seconds: int = 60  # Cache TTL for quotes
    request_timeout: int = 15
    max_retries: int = 3
    retry_delay: float = 1.0

    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            twelvedata_api_key=os.environ.get("TWELVE_DATA_API_KEY", ""),
            cache_dir=os.environ.get("PRICE_CACHE_DIR", ".price_cache"),
            cache_ttl_seconds=int(os.environ.get("PRICE_CACHE_TTL", "60")),
            request_timeout=int(os.environ.get("PRICE_REQUEST_TIMEOUT", "15")),
            max_retries=int(os.environ.get("PRICE_MAX_RETRIES", "3")),
        )


# =============================================================================
# Asset Definitions
# =============================================================================

# Stocks and ETFs - TwelveData symbols
STOCKS_ETFS = {
    "SPY": {"name": "S&P 500 ETF", "type": "etf", "twelvedata": "SPY"},
    "QQQ": {"name": "Nasdaq 100 ETF", "type": "etf", "twelvedata": "QQQ"},
    "AAPL": {"name": "Apple Inc", "type": "stock", "twelvedata": "AAPL"},
    "MSFT": {"name": "Microsoft Corp", "type": "stock", "twelvedata": "MSFT"},
    "GOOGL": {"name": "Alphabet Inc", "type": "stock", "twelvedata": "GOOGL"},
    "AMZN": {"name": "Amazon.com Inc", "type": "stock", "twelvedata": "AMZN"},
    "NVDA": {"name": "NVIDIA Corp", "type": "stock", "twelvedata": "NVDA"},
    "META": {"name": "Meta Platforms", "type": "stock", "twelvedata": "META"},
    "TSLA": {"name": "Tesla Inc", "type": "stock", "twelvedata": "TSLA"},
}

# Commodities - TwelveData forex-style symbols
COMMODITIES = {
    "GOLD": {"name": "Gold", "type": "commodity", "twelvedata": "XAU/USD", "legacy_symbol": "GC=F"},
    "SILVER": {"name": "Silver", "type": "commodity", "twelvedata": "XAG/USD", "legacy_symbol": "SI=F"},
    "OIL": {"name": "Crude Oil (WTI)", "type": "commodity", "twelvedata": "WTI/USD", "legacy_symbol": "CL=F"},
}

# Cryptocurrencies - CoinGecko IDs
CRYPTO = {
    "BTC": {"name": "Bitcoin", "type": "crypto", "coingecko_id": "bitcoin"},
    "ETH": {"name": "Ethereum", "type": "crypto", "coingecko_id": "ethereum"},
    "USDC": {"name": "USD Coin", "type": "crypto", "coingecko_id": "usd-coin"},
    "USDT": {"name": "Tether", "type": "crypto", "coingecko_id": "tether"},
    "BNB": {"name": "BNB", "type": "crypto", "coingecko_id": "binancecoin"},
    "SOL": {"name": "Solana", "type": "crypto", "coingecko_id": "solana"},
    "ARB": {"name": "Arbitrum", "type": "crypto", "coingecko_id": "arbitrum"},
    "OP": {"name": "Optimism", "type": "crypto", "coingecko_id": "optimism"},
    "MATIC": {"name": "Polygon", "type": "crypto", "coingecko_id": "matic-network"},
    "LINK": {"name": "Chainlink", "type": "crypto", "coingecko_id": "chainlink"},
    "UNI": {"name": "Uniswap", "type": "crypto", "coingecko_id": "uniswap"},
    "AAVE": {"name": "Aave", "type": "crypto", "coingecko_id": "aave"},
    "CRV": {"name": "Curve DAO", "type": "crypto", "coingecko_id": "curve-dao-token"},
}

# Combined mapping for all assets
ALL_ASSETS = {**STOCKS_ETFS, **COMMODITIES, **CRYPTO}


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class PriceQuote:
    """Price quote for an asset."""
    symbol: str
    name: str
    price: float
    change_24h: float  # Percentage
    change_24h_usd: float  # Absolute USD change
    high_24h: Optional[float]
    low_24h: Optional[float]
    volume_24h: Optional[float]
    market_cap: Optional[float]
    timestamp: str
    source: str
    asset_type: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PriceCandle:
    """OHLCV candle data."""
    time: int  # Unix timestamp
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class HistoricalData:
    """Historical price data for an asset."""
    symbol: str
    name: str
    candles: list[PriceCandle]
    interval: str
    source: str


# =============================================================================
# Cache Manager
# =============================================================================

class CacheManager:
    """Simple file-based cache for price data."""

    def __init__(self, cache_dir: str, ttl_seconds: int = 60):
        self.cache_dir = Path(cache_dir)
        self.ttl_seconds = ttl_seconds
        self.cache_dir.mkdir(exist_ok=True)

    def _get_cache_path(self, key: str) -> Path:
        """Get cache file path for a key."""
        safe_key = key.replace("/", "_").replace(":", "_")
        return self.cache_dir / f"{safe_key}.json"

    def get(self, key: str) -> Optional[dict]:
        """Get cached data if not expired."""
        cache_path = self._get_cache_path(key)
        if not cache_path.exists():
            return None

        try:
            with open(cache_path, "r") as f:
                data = json.load(f)

            cached_time = datetime.fromisoformat(data.get("_cached_at", "2000-01-01"))
            if datetime.now() - cached_time > timedelta(seconds=self.ttl_seconds):
                return None

            return data.get("data")
        except (json.JSONDecodeError, KeyError):
            return None

    def set(self, key: str, data: dict) -> None:
        """Cache data with timestamp."""
        cache_path = self._get_cache_path(key)
        cache_data = {
            "_cached_at": datetime.now().isoformat(),
            "data": data
        }
        with open(cache_path, "w") as f:
            json.dump(cache_data, f)

    def clear(self) -> None:
        """Clear all cached data."""
        for cache_file in self.cache_dir.glob("*.json"):
            cache_file.unlink()


# =============================================================================
# TwelveData API Client
# =============================================================================

class TwelveDataClient:
    """Client for TwelveData API - Stocks, ETFs, Commodities."""

    BASE_URL = "https://api.twelvedata.com"

    # Interval mappings for historical data
    INTERVALS = {
        "1D": ("15min", 96),      # 15-min candles for 1 day
        "1W": ("1h", 168),        # Hourly candles for 1 week
        "1M": ("1day", 30),       # Daily candles for 1 month
        "3M": ("1day", 90),       # Daily candles for 3 months
        "1Y": ("1day", 365),      # Daily candles for 1 year
        "5Y": ("1week", 260),     # Weekly candles for 5 years
    }

    def __init__(self, api_key: str, config: Config):
        self.api_key = api_key
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "InsiderTrading-PriceFetcher/1.0"
        })

    def _request(self, endpoint: str, params: dict) -> dict:
        """Make API request with retry logic."""
        params["apikey"] = self.api_key
        url = f"{self.BASE_URL}/{endpoint}"

        last_error = None
        for attempt in range(self.config.max_retries):
            try:
                response = self.session.get(
                    url,
                    params=params,
                    timeout=self.config.request_timeout
                )
                response.raise_for_status()
                data = response.json()

                # Check for API-level errors
                if data.get("status") == "error":
                    raise ValueError(data.get("message", "Unknown API error"))

                return data

            except requests.RequestException as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                if attempt < self.config.max_retries - 1:
                    time.sleep(self.config.retry_delay * (2 ** attempt))

        raise last_error or Exception("All retry attempts failed")

    def get_quote(self, symbol: str) -> dict:
        """Get real-time quote for a symbol."""
        return self._request("quote", {"symbol": symbol})

    def get_quotes(self, symbols: list[str]) -> dict:
        """Get multiple quotes at once."""
        symbols_param = ",".join(symbols)
        return self._request("quote", {"symbol": symbols_param})

    def get_time_series(self, symbol: str, interval: str, outputsize: int) -> dict:
        """Get historical time series data."""
        return self._request("time_series", {
            "symbol": symbol,
            "interval": interval,
            "outputsize": outputsize
        })

    def fetch_stock_quotes(self) -> list[PriceQuote]:
        """Fetch quotes for all stocks and ETFs."""
        if not self.api_key:
            raise ValueError("TWELVE_DATA_API_KEY not configured")

        quotes = []
        symbols = [info["twelvedata"] for info in STOCKS_ETFS.values()]

        try:
            data = self.get_quotes(symbols)

            # Handle single vs multiple response format
            if isinstance(data, dict) and "symbol" in data:
                # Single symbol response
                data = {data["symbol"]: data}

            for symbol, info in STOCKS_ETFS.items():
                td_symbol = info["twelvedata"]
                quote_data = data.get(td_symbol, {})

                if quote_data.get("status") == "error":
                    logger.warning(f"Error fetching {symbol}: {quote_data.get('message')}")
                    continue

                price = float(quote_data.get("close", 0))
                prev_close = float(quote_data.get("previous_close", price))
                change_usd = price - prev_close
                change_pct = (change_usd / prev_close * 100) if prev_close > 0 else 0

                quotes.append(PriceQuote(
                    symbol=symbol,
                    name=info["name"],
                    price=price,
                    change_24h=round(change_pct, 2),
                    change_24h_usd=round(change_usd, 2),
                    high_24h=float(quote_data.get("high", 0)) or None,
                    low_24h=float(quote_data.get("low", 0)) or None,
                    volume_24h=float(quote_data.get("volume", 0)) or None,
                    market_cap=None,
                    timestamp=datetime.now().isoformat(),
                    source="twelvedata",
                    asset_type=info["type"]
                ))
        except Exception as e:
            logger.error(f"Error fetching stock quotes: {e}")
            raise

        return quotes

    def fetch_commodity_quotes(self) -> list[PriceQuote]:
        """Fetch quotes for all commodities."""
        if not self.api_key:
            raise ValueError("TWELVE_DATA_API_KEY not configured")

        quotes = []
        symbols = [info["twelvedata"] for info in COMMODITIES.values()]

        try:
            data = self.get_quotes(symbols)

            # Handle single vs multiple response format
            if isinstance(data, dict) and "symbol" in data:
                data = {data["symbol"]: data}

            for symbol, info in COMMODITIES.items():
                td_symbol = info["twelvedata"]
                quote_data = data.get(td_symbol, {})

                if quote_data.get("status") == "error":
                    logger.warning(f"Error fetching {symbol}: {quote_data.get('message')}")
                    continue

                price = float(quote_data.get("close", 0))
                prev_close = float(quote_data.get("previous_close", price))
                change_usd = price - prev_close
                change_pct = (change_usd / prev_close * 100) if prev_close > 0 else 0

                quotes.append(PriceQuote(
                    symbol=symbol,
                    name=info["name"],
                    price=price,
                    change_24h=round(change_pct, 2),
                    change_24h_usd=round(change_usd, 4),
                    high_24h=float(quote_data.get("high", 0)) or None,
                    low_24h=float(quote_data.get("low", 0)) or None,
                    volume_24h=None,  # Forex pairs don't have volume
                    market_cap=None,
                    timestamp=datetime.now().isoformat(),
                    source="twelvedata",
                    asset_type="commodity"
                ))
        except Exception as e:
            logger.error(f"Error fetching commodity quotes: {e}")
            raise

        return quotes

    def fetch_historical(self, symbol: str, window: str = "1M") -> HistoricalData:
        """Fetch historical price data for a symbol."""
        if not self.api_key:
            raise ValueError("TWELVE_DATA_API_KEY not configured")

        # Get symbol mapping
        asset_info = STOCKS_ETFS.get(symbol) or COMMODITIES.get(symbol)
        if not asset_info:
            raise ValueError(f"Unknown symbol: {symbol}")

        td_symbol = asset_info["twelvedata"]
        interval, outputsize = self.INTERVALS.get(window, self.INTERVALS["1M"])

        data = self.get_time_series(td_symbol, interval, outputsize)

        if "values" not in data:
            raise ValueError("No historical data returned")

        # Convert to candles (TwelveData returns newest first)
        candles = []
        for v in reversed(data["values"]):
            try:
                candles.append(PriceCandle(
                    time=int(datetime.fromisoformat(v["datetime"].replace(" ", "T")).timestamp()),
                    open=float(v["open"]),
                    high=float(v["high"]),
                    low=float(v["low"]),
                    close=float(v["close"]),
                    volume=float(v.get("volume", 0))
                ))
            except (ValueError, KeyError) as e:
                logger.warning(f"Skipping invalid candle: {e}")

        return HistoricalData(
            symbol=symbol,
            name=asset_info["name"],
            candles=candles,
            interval=interval,
            source="twelvedata"
        )


# =============================================================================
# CoinGecko API Client
# =============================================================================

class CoinGeckoClient:
    """Client for CoinGecko API - Cryptocurrencies."""

    BASE_URL = "https://api.coingecko.com/api/v3"

    def __init__(self, config: Config):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": "InsiderTrading-PriceFetcher/1.0"
        })

    def _request(self, endpoint: str, params: dict = None) -> dict:
        """Make API request with retry logic."""
        url = f"{self.BASE_URL}/{endpoint}"

        last_error = None
        for attempt in range(self.config.max_retries):
            try:
                response = self.session.get(
                    url,
                    params=params or {},
                    timeout=self.config.request_timeout
                )

                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 60))
                    logger.warning(f"Rate limited. Waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue

                response.raise_for_status()
                return response.json()

            except requests.RequestException as e:
                last_error = e
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                if attempt < self.config.max_retries - 1:
                    time.sleep(self.config.retry_delay * (2 ** attempt))

        raise last_error or Exception("All retry attempts failed")

    def fetch_crypto_quotes(self) -> list[PriceQuote]:
        """Fetch quotes for all cryptocurrencies."""
        quotes = []

        # Get all CoinGecko IDs
        coin_ids = [info["coingecko_id"] for info in CRYPTO.values()]
        ids_param = ",".join(coin_ids)

        try:
            data = self._request("coins/markets", {
                "vs_currency": "usd",
                "ids": ids_param,
                "order": "market_cap_desc",
                "per_page": 100,
                "page": 1,
                "sparkline": "false",
                "price_change_percentage": "24h"
            })

            # Create lookup by ID
            data_by_id = {item["id"]: item for item in data}

            for symbol, info in CRYPTO.items():
                coin_data = data_by_id.get(info["coingecko_id"])
                if not coin_data:
                    logger.warning(f"No data found for {symbol}")
                    continue

                price = coin_data.get("current_price", 0)
                change_pct = coin_data.get("price_change_percentage_24h", 0) or 0
                change_usd = coin_data.get("price_change_24h", 0) or 0

                quotes.append(PriceQuote(
                    symbol=symbol,
                    name=info["name"],
                    price=price,
                    change_24h=round(change_pct, 2),
                    change_24h_usd=round(change_usd, 4),
                    high_24h=coin_data.get("high_24h"),
                    low_24h=coin_data.get("low_24h"),
                    volume_24h=coin_data.get("total_volume"),
                    market_cap=coin_data.get("market_cap"),
                    timestamp=datetime.now().isoformat(),
                    source="coingecko",
                    asset_type="crypto"
                ))
        except Exception as e:
            logger.error(f"Error fetching crypto quotes: {e}")
            raise

        return quotes

    def fetch_historical(self, symbol: str, days: int = 30) -> HistoricalData:
        """Fetch historical price data for a cryptocurrency."""
        asset_info = CRYPTO.get(symbol)
        if not asset_info:
            raise ValueError(f"Unknown crypto symbol: {symbol}")

        coin_id = asset_info["coingecko_id"]

        data = self._request(f"coins/{coin_id}/market_chart", {
            "vs_currency": "usd",
            "days": days,
            "interval": "daily" if days > 1 else "hourly"
        })

        if "prices" not in data:
            raise ValueError("No historical data returned")

        # CoinGecko returns [timestamp_ms, price] pairs
        # We need to construct OHLC from the data
        prices = data["prices"]
        volumes = data.get("total_volumes", [])

        # Create volume lookup
        volume_lookup = {int(v[0] / 1000): v[1] for v in volumes}

        candles = []
        for i, (timestamp_ms, price) in enumerate(prices):
            timestamp = int(timestamp_ms / 1000)
            volume = volume_lookup.get(timestamp, 0)

            # For daily data, we approximate OHLC
            # In reality, we'd need separate OHLC endpoint
            candles.append(PriceCandle(
                time=timestamp,
                open=price,
                high=price * 1.005,  # Approximate
                low=price * 0.995,   # Approximate
                close=price,
                volume=volume
            ))

        return HistoricalData(
            symbol=symbol,
            name=asset_info["name"],
            candles=candles,
            interval="1day" if days > 1 else "1hour",
            source="coingecko"
        )


# =============================================================================
# Price Fetcher - Main Interface
# =============================================================================

class PriceFetcher:
    """Main interface for fetching price data from all sources."""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config.from_env()
        self.cache = CacheManager(
            self.config.cache_dir,
            self.config.cache_ttl_seconds
        )
        self.twelvedata = TwelveDataClient(
            self.config.twelvedata_api_key,
            self.config
        )
        self.coingecko = CoinGeckoClient(self.config)

    def get_all_quotes(self, use_cache: bool = True) -> list[PriceQuote]:
        """Fetch quotes for all assets."""
        cache_key = "all_quotes"

        if use_cache:
            cached = self.cache.get(cache_key)
            if cached:
                logger.info("Returning cached quotes")
                return [PriceQuote(**q) for q in cached]

        quotes = []

        # Fetch from TwelveData (stocks, ETFs, commodities)
        if self.config.twelvedata_api_key:
            try:
                quotes.extend(self.twelvedata.fetch_stock_quotes())
                logger.info(f"Fetched {len(STOCKS_ETFS)} stock/ETF quotes")
            except Exception as e:
                logger.error(f"Failed to fetch stock quotes: {e}")

            try:
                quotes.extend(self.twelvedata.fetch_commodity_quotes())
                logger.info(f"Fetched {len(COMMODITIES)} commodity quotes")
            except Exception as e:
                logger.error(f"Failed to fetch commodity quotes: {e}")
        else:
            logger.warning("TwelveData API key not configured - skipping stocks/commodities")

        # Fetch from CoinGecko (crypto)
        try:
            quotes.extend(self.coingecko.fetch_crypto_quotes())
            logger.info(f"Fetched {len(CRYPTO)} crypto quotes")
        except Exception as e:
            logger.error(f"Failed to fetch crypto quotes: {e}")

        # Cache results
        if quotes and use_cache:
            self.cache.set(cache_key, [q.to_dict() for q in quotes])

        return quotes

    def get_stock_quotes(self, use_cache: bool = True) -> list[PriceQuote]:
        """Fetch quotes for stocks and ETFs only."""
        cache_key = "stock_quotes"

        if use_cache:
            cached = self.cache.get(cache_key)
            if cached:
                return [PriceQuote(**q) for q in cached]

        quotes = self.twelvedata.fetch_stock_quotes()

        if quotes and use_cache:
            self.cache.set(cache_key, [q.to_dict() for q in quotes])

        return quotes

    def get_commodity_quotes(self, use_cache: bool = True) -> list[PriceQuote]:
        """Fetch quotes for commodities only."""
        cache_key = "commodity_quotes"

        if use_cache:
            cached = self.cache.get(cache_key)
            if cached:
                return [PriceQuote(**q) for q in cached]

        quotes = self.twelvedata.fetch_commodity_quotes()

        if quotes and use_cache:
            self.cache.set(cache_key, [q.to_dict() for q in quotes])

        return quotes

    def get_crypto_quotes(self, use_cache: bool = True) -> list[PriceQuote]:
        """Fetch quotes for cryptocurrencies only."""
        cache_key = "crypto_quotes"

        if use_cache:
            cached = self.cache.get(cache_key)
            if cached:
                return [PriceQuote(**q) for q in cached]

        quotes = self.coingecko.fetch_crypto_quotes()

        if quotes and use_cache:
            self.cache.set(cache_key, [q.to_dict() for q in quotes])

        return quotes

    def get_quote(self, symbol: str, use_cache: bool = True) -> Optional[PriceQuote]:
        """Fetch quote for a single symbol."""
        symbol = symbol.upper()

        # Determine source based on asset type
        if symbol in STOCKS_ETFS or symbol in COMMODITIES:
            quotes = self.get_stock_quotes(use_cache) if symbol in STOCKS_ETFS else self.get_commodity_quotes(use_cache)
        elif symbol in CRYPTO:
            quotes = self.get_crypto_quotes(use_cache)
        else:
            logger.error(f"Unknown symbol: {symbol}")
            return None

        for quote in quotes:
            if quote.symbol == symbol:
                return quote

        return None

    def get_historical(self, symbol: str, window: str = "1M") -> Optional[HistoricalData]:
        """Fetch historical data for a symbol."""
        symbol = symbol.upper()

        # Determine source
        if symbol in STOCKS_ETFS or symbol in COMMODITIES:
            return self.twelvedata.fetch_historical(symbol, window)
        elif symbol in CRYPTO:
            # Convert window to days for CoinGecko
            days_map = {"1D": 1, "1W": 7, "1M": 30, "3M": 90, "1Y": 365, "5Y": 1825}
            days = days_map.get(window, 30)
            return self.coingecko.fetch_historical(symbol, days)
        else:
            logger.error(f"Unknown symbol: {symbol}")
            return None

    def export_prices_json(self, filepath: str = "prices.json") -> None:
        """Export all prices to JSON file."""
        quotes = self.get_all_quotes(use_cache=False)

        output = {
            "timestamp": datetime.now().isoformat(),
            "count": len(quotes),
            "prices": {}
        }

        for quote in quotes:
            output["prices"][quote.symbol] = {
                "name": quote.name,
                "price": quote.price,
                "change_24h": quote.change_24h,
                "change_24h_usd": quote.change_24h_usd,
                "high_24h": quote.high_24h,
                "low_24h": quote.low_24h,
                "volume_24h": quote.volume_24h,
                "market_cap": quote.market_cap,
                "source": quote.source,
                "type": quote.asset_type
            }

        with open(filepath, "w") as f:
            json.dump(output, f, indent=2)

        logger.info(f"Exported {len(quotes)} prices to {filepath}")

    def clear_cache(self) -> None:
        """Clear the price cache."""
        self.cache.clear()
        logger.info("Cache cleared")


# =============================================================================
# CLI Interface
# =============================================================================

def format_price(price: float, decimals: int = 2) -> str:
    """Format price with appropriate decimals."""
    if price >= 1:
        return f"${price:,.{decimals}f}"
    else:
        return f"${price:.6f}"


def format_change(change: float) -> str:
    """Format percentage change with color indicator."""
    sign = "+" if change >= 0 else ""
    return f"{sign}{change:.2f}%"


def print_quotes_table(quotes: list[PriceQuote]) -> None:
    """Print quotes in a formatted table."""
    if not quotes:
        print("No quotes available")
        return

    # Header
    print(f"\n{'Symbol':<10} {'Name':<20} {'Price':>14} {'24h Change':>12} {'Type':<10} {'Source':<12}")
    print("-" * 80)

    # Sort by type then symbol
    quotes.sort(key=lambda q: (q.asset_type, q.symbol))

    for q in quotes:
        print(f"{q.symbol:<10} {q.name:<20} {format_price(q.price):>14} {format_change(q.change_24h):>12} {q.asset_type:<10} {q.source:<12}")

    print(f"\nTotal: {len(quotes)} assets | Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Fetch price data from TwelveData and CoinGecko",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s quotes --all          Fetch all prices
  %(prog)s quotes --stocks       Fetch stock/ETF prices only
  %(prog)s quotes --crypto       Fetch crypto prices only
  %(prog)s quotes --commodities  Fetch commodity prices only
  %(prog)s quote BTC             Fetch single quote
  %(prog)s history BTC --window 1M   Fetch historical data
  %(prog)s export prices.json    Export all prices to JSON
  %(prog)s list                  List all supported symbols
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # quotes command
    quotes_parser = subparsers.add_parser("quotes", help="Fetch price quotes")
    quotes_group = quotes_parser.add_mutually_exclusive_group()
    quotes_group.add_argument("--all", action="store_true", help="Fetch all assets")
    quotes_group.add_argument("--stocks", action="store_true", help="Fetch stocks/ETFs only")
    quotes_group.add_argument("--crypto", action="store_true", help="Fetch crypto only")
    quotes_group.add_argument("--commodities", action="store_true", help="Fetch commodities only")
    quotes_parser.add_argument("--no-cache", action="store_true", help="Bypass cache")
    quotes_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # quote (single) command
    quote_parser = subparsers.add_parser("quote", help="Fetch single quote")
    quote_parser.add_argument("symbol", help="Asset symbol (e.g., BTC, AAPL, GOLD)")
    quote_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # history command
    history_parser = subparsers.add_parser("history", help="Fetch historical data")
    history_parser.add_argument("symbol", help="Asset symbol")
    history_parser.add_argument("--window", default="1M", choices=["1D", "1W", "1M", "3M", "1Y", "5Y"],
                               help="Time window (default: 1M)")
    history_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # export command
    export_parser = subparsers.add_parser("export", help="Export prices to JSON")
    export_parser.add_argument("filepath", nargs="?", default="prices.json",
                              help="Output file path (default: prices.json)")

    # list command
    subparsers.add_parser("list", help="List all supported symbols")

    # cache command
    cache_parser = subparsers.add_parser("cache", help="Cache management")
    cache_parser.add_argument("--clear", action="store_true", help="Clear cache")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize fetcher
    fetcher = PriceFetcher()

    try:
        if args.command == "quotes":
            use_cache = not getattr(args, "no_cache", False)

            if args.stocks:
                quotes = fetcher.get_stock_quotes(use_cache)
            elif args.crypto:
                quotes = fetcher.get_crypto_quotes(use_cache)
            elif args.commodities:
                quotes = fetcher.get_commodity_quotes(use_cache)
            else:  # --all or default
                quotes = fetcher.get_all_quotes(use_cache)

            if args.json:
                print(json.dumps([q.to_dict() for q in quotes], indent=2))
            else:
                print_quotes_table(quotes)

        elif args.command == "quote":
            quote = fetcher.get_quote(args.symbol)
            if quote:
                if args.json:
                    print(json.dumps(quote.to_dict(), indent=2))
                else:
                    print(f"\n{quote.symbol} - {quote.name}")
                    print(f"Price: {format_price(quote.price)}")
                    print(f"24h Change: {format_change(quote.change_24h)} ({format_price(quote.change_24h_usd)})")
                    if quote.high_24h:
                        print(f"24h High: {format_price(quote.high_24h)}")
                    if quote.low_24h:
                        print(f"24h Low: {format_price(quote.low_24h)}")
                    if quote.volume_24h:
                        print(f"24h Volume: ${quote.volume_24h:,.0f}")
                    if quote.market_cap:
                        print(f"Market Cap: ${quote.market_cap:,.0f}")
                    print(f"Source: {quote.source}")
            else:
                print(f"Symbol not found: {args.symbol}")
                sys.exit(1)

        elif args.command == "history":
            data = fetcher.get_historical(args.symbol, args.window)
            if data:
                if args.json:
                    output = {
                        "symbol": data.symbol,
                        "name": data.name,
                        "interval": data.interval,
                        "source": data.source,
                        "candles": [asdict(c) for c in data.candles]
                    }
                    print(json.dumps(output, indent=2))
                else:
                    print(f"\n{data.symbol} - {data.name} ({args.window})")
                    print(f"Interval: {data.interval}")
                    print(f"Data points: {len(data.candles)}")
                    if data.candles:
                        first = data.candles[0]
                        last = data.candles[-1]
                        print(f"Range: {datetime.fromtimestamp(first.time)} to {datetime.fromtimestamp(last.time)}")
                        print(f"Open: {format_price(first.open)} -> Close: {format_price(last.close)}")
                        change = (last.close - first.open) / first.open * 100
                        print(f"Period Change: {format_change(change)}")
            else:
                print(f"Could not fetch historical data for: {args.symbol}")
                sys.exit(1)

        elif args.command == "export":
            fetcher.export_prices_json(args.filepath)
            print(f"Prices exported to {args.filepath}")

        elif args.command == "list":
            print("\nSupported Symbols:")
            print("\n--- Stocks & ETFs (TwelveData) ---")
            for symbol, info in sorted(STOCKS_ETFS.items()):
                print(f"  {symbol:<10} {info['name']}")

            print("\n--- Commodities (TwelveData) ---")
            for symbol, info in sorted(COMMODITIES.items()):
                print(f"  {symbol:<10} {info['name']}")

            print("\n--- Cryptocurrencies (CoinGecko) ---")
            for symbol, info in sorted(CRYPTO.items()):
                print(f"  {symbol:<10} {info['name']}")

            print(f"\nTotal: {len(ALL_ASSETS)} assets")

        elif args.command == "cache":
            if args.clear:
                fetcher.clear_cache()
                print("Cache cleared")

    except KeyboardInterrupt:
        print("\nAborted")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
