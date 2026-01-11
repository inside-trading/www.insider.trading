// Price Service - Fetches historical price data
// Uses Yahoo Finance API (via query endpoints)

const https = require('https');

// Window configurations
const WINDOW_CONFIG = {
    '1D': { range: '5d', interval: '15m' },
    '1W': { range: '1mo', interval: '1h' },
    '1M': { range: '6mo', interval: '1d' },
    '1Y': { range: '2y', interval: '1d' },
    '3Y': { range: '5y', interval: '1wk' },
    '5Y': { range: '10y', interval: '1wk' },
    '10Y': { range: 'max', interval: '1mo' }
};

// Asset mappings for Yahoo Finance
const ASSET_SYMBOLS = {
    'SPY': 'SPY',
    'QQQ': 'QQQ',
    'AAPL': 'AAPL',
    'TSLA': 'TSLA',
    'MSFT': 'MSFT',
    'GOOGL': 'GOOGL',
    'AMZN': 'AMZN',
    'NVDA': 'NVDA',
    'META': 'META',
    'BTC-USD': 'BTC-USD',
    'ETH-USD': 'ETH-USD',
    'SOL-USD': 'SOL-USD',
    'GC=F': 'GC=F',
    'CL=F': 'CL=F'
};

class PriceService {
    /**
     * Get historical prices for an asset
     */
    static async getHistoricalPrices(symbol, window = '1W') {
        const config = WINDOW_CONFIG[window] || WINDOW_CONFIG['1W'];
        const yahooSymbol = ASSET_SYMBOLS[symbol] || symbol;

        try {
            const data = await this.fetchYahooData(yahooSymbol, config.range, config.interval);
            return data;
        } catch (error) {
            console.error('Yahoo Finance error:', error.message);
            // Return mock data as fallback
            return this.generateMockData(symbol, window);
        }
    }

    /**
     * Fetch data from Yahoo Finance
     */
    static fetchYahooData(symbol, range, interval) {
        return new Promise((resolve, reject) => {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

            https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (res) => {
                let data = '';

                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        if (json.chart?.error) {
                            reject(new Error(json.chart.error.description));
                            return;
                        }

                        const result = json.chart?.result?.[0];
                        if (!result) {
                            reject(new Error('No data returned'));
                            return;
                        }

                        const timestamps = result.timestamp || [];
                        const quote = result.indicators?.quote?.[0] || {};

                        const candles = timestamps.map((time, i) => ({
                            time,
                            open: quote.open?.[i] || 0,
                            high: quote.high?.[i] || 0,
                            low: quote.low?.[i] || 0,
                            close: quote.close?.[i] || 0,
                            volume: quote.volume?.[i] || 0
                        })).filter(c => c.open && c.close);

                        if (candles.length === 0) {
                            reject(new Error('No valid candles'));
                            return;
                        }

                        const lastPrice = candles[candles.length - 1].close;
                        const firstPrice = candles[0].open;
                        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

                        resolve({
                            symbol,
                            candles,
                            lastPrice,
                            priceChange,
                            currency: result.meta?.currency || 'USD',
                            exchange: result.meta?.exchangeName || ''
                        });
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    /**
     * Get current quote for an asset
     */
    static async getQuote(symbol) {
        const yahooSymbol = ASSET_SYMBOLS[symbol] || symbol;

        try {
            const data = await this.fetchYahooData(yahooSymbol, '1d', '1m');
            return {
                symbol,
                price: data.lastPrice,
                change: data.priceChange,
                timestamp: Date.now()
            };
        } catch (error) {
            // Return mock quote
            return this.generateMockQuote(symbol);
        }
    }

    /**
     * Generate mock data as fallback
     */
    static generateMockData(symbol, window) {
        const config = WINDOW_CONFIG[window] || WINDOW_CONFIG['1W'];

        // Determine number of candles and time span
        const candleCounts = {
            '1D': 96,    // 15min intervals
            '1W': 168,   // hourly
            '1M': 180,   // daily
            '1Y': 365,   // daily
            '3Y': 156,   // weekly
            '5Y': 260,   // weekly
            '10Y': 120   // monthly
        };

        const numCandles = candleCounts[window] || 100;

        // Base prices for different assets
        const basePrices = {
            'SPY': 450, 'QQQ': 380, 'AAPL': 175, 'TSLA': 250,
            'MSFT': 380, 'GOOGL': 140, 'AMZN': 175, 'NVDA': 480,
            'META': 350, 'BTC-USD': 43000, 'ETH-USD': 2400,
            'SOL-USD': 100, 'GC=F': 2000, 'CL=F': 75
        };

        let price = basePrices[symbol] || 100;
        const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL');
        const volatility = isCrypto ? 0.03 : 0.012;

        const candles = [];
        const now = Date.now();

        // Calculate time interval in ms
        const intervalMs = {
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '1wk': 7 * 24 * 60 * 60 * 1000,
            '1mo': 30 * 24 * 60 * 60 * 1000
        };

        const interval = intervalMs[config.interval] || intervalMs['1d'];

        for (let i = numCandles - 1; i >= 0; i--) {
            const time = Math.floor((now - (i * interval)) / 1000);
            const change = (Math.random() - 0.48) * volatility;
            const open = price;
            price = price * (1 + change);
            const close = price;
            const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
            const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

            candles.push({
                time,
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(close.toFixed(2)),
                volume: Math.floor(Math.random() * 10000000)
            });
        }

        const lastPrice = candles[candles.length - 1].close;
        const firstPrice = candles[0].open;
        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

        return {
            symbol,
            candles,
            lastPrice,
            priceChange,
            currency: 'USD',
            exchange: 'Mock'
        };
    }

    /**
     * Generate mock quote
     */
    static generateMockQuote(symbol) {
        const basePrices = {
            'SPY': 450, 'QQQ': 380, 'AAPL': 175, 'TSLA': 250,
            'MSFT': 380, 'GOOGL': 140, 'AMZN': 175, 'NVDA': 480,
            'META': 350, 'BTC-USD': 43000, 'ETH-USD': 2400,
            'SOL-USD': 100, 'GC=F': 2000, 'CL=F': 75
        };

        const basePrice = basePrices[symbol] || 100;
        const variation = (Math.random() - 0.5) * 0.02;
        const price = basePrice * (1 + variation);
        const change = variation * 100;

        return {
            symbol,
            price: parseFloat(price.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            timestamp: Date.now()
        };
    }
}

module.exports = PriceService;
