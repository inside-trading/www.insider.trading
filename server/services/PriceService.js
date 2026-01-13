// Price Service - Fetches historical price data from TwelveData API

const https = require('https');

// TwelveData API configuration
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
const TWELVE_DATA_BASE_URL = 'https://api.twelvedata.com';

// Window configurations for TwelveData
const WINDOW_CONFIG = {
    '1D': { interval: '15min', outputsize: 96 },      // 96 x 15min = 24 hours
    '1W': { interval: '1h', outputsize: 168 },        // 168 hours = 1 week
    '1M': { interval: '1day', outputsize: 30 },       // 30 days
    '1Y': { interval: '1day', outputsize: 365 },      // 365 days
    '3Y': { interval: '1week', outputsize: 156 },     // 156 weeks = 3 years
    '5Y': { interval: '1week', outputsize: 260 },     // 260 weeks = 5 years
    '10Y': { interval: '1month', outputsize: 120 }    // 120 months = 10 years
};

// Asset symbol mappings for TwelveData
// TwelveData uses different formats: stocks are plain symbols, crypto is BASE/QUOTE
const ASSET_SYMBOLS = {
    // Stocks & ETFs (direct symbols)
    'SPY': { symbol: 'SPY', type: 'stock' },
    'QQQ': { symbol: 'QQQ', type: 'stock' },
    'AAPL': { symbol: 'AAPL', type: 'stock' },
    'TSLA': { symbol: 'TSLA', type: 'stock' },
    'MSFT': { symbol: 'MSFT', type: 'stock' },
    'GOOGL': { symbol: 'GOOGL', type: 'stock' },
    'AMZN': { symbol: 'AMZN', type: 'stock' },
    'NVDA': { symbol: 'NVDA', type: 'stock' },
    'META': { symbol: 'META', type: 'stock' },
    // Crypto (BASE/QUOTE format)
    'BTC-USD': { symbol: 'BTC/USD', type: 'crypto' },
    'ETH-USD': { symbol: 'ETH/USD', type: 'crypto' },
    'SOL-USD': { symbol: 'SOL/USD', type: 'crypto' },
    // Commodities (futures symbols)
    'GC=F': { symbol: 'XAU/USD', type: 'commodity' },  // Gold
    'SI=F': { symbol: 'XAG/USD', type: 'commodity' },  // Silver
    'CL=F': { symbol: 'XBR/USD', type: 'commodity' }   // Crude Oil (Brent)
};

class PriceService {
    /**
     * Get historical prices for an asset
     */
    static async getHistoricalPrices(symbol, window = '1W') {
        if (!TWELVE_DATA_API_KEY) {
            throw new Error('TwelveData API key not configured');
        }

        const config = WINDOW_CONFIG[window] || WINDOW_CONFIG['1W'];
        const assetConfig = ASSET_SYMBOLS[symbol];

        if (!assetConfig) {
            throw new Error(`Unknown symbol: ${symbol}`);
        }

        const data = await this.fetchTwelveData(assetConfig.symbol, config.interval, config.outputsize);
        return data;
    }

    /**
     * Fetch data from TwelveData API
     */
    static async fetchTwelveData(symbol, interval, outputsize, retries = 3) {
        const url = `${TWELVE_DATA_BASE_URL}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVE_DATA_API_KEY}`;

        let lastError = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const result = await this.fetchWithTimeout(url, 15000);
                return result;
            } catch (error) {
                lastError = error;
                console.error(`TwelveData attempt ${attempt + 1} failed for ${symbol}: ${error.message}`);

                // Wait before retry (exponential backoff)
                if (attempt < retries - 1) {
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                }
            }
        }

        throw lastError || new Error('All fetch attempts failed');
    }

    /**
     * Fetch with timeout
     */
    static fetchWithTimeout(url, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'InsiderTrading/1.0',
                    'Accept': 'application/json'
                },
                timeout
            }, (res) => {
                if (res.statusCode === 429) {
                    reject(new Error('Rate limit exceeded - please try again later'));
                    return;
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        // Check for API errors
                        if (json.status === 'error') {
                            reject(new Error(json.message || 'API error'));
                            return;
                        }

                        // Validate response structure
                        if (!json.values || !Array.isArray(json.values)) {
                            reject(new Error('Invalid response format'));
                            return;
                        }

                        // Transform TwelveData response to our format
                        // TwelveData returns newest first, we want oldest first
                        const candles = json.values.reverse().map(item => ({
                            time: this.parseDateTime(item.datetime),
                            open: parseFloat(item.open),
                            high: parseFloat(item.high),
                            low: parseFloat(item.low),
                            close: parseFloat(item.close),
                            volume: item.volume ? parseInt(item.volume) : 0
                        })).filter(c =>
                            !isNaN(c.open) && !isNaN(c.close) &&
                            c.open > 0 && c.close > 0
                        );

                        if (candles.length < 2) {
                            reject(new Error('Insufficient data points'));
                            return;
                        }

                        const lastPrice = candles[candles.length - 1].close;
                        const firstPrice = candles[0].open;
                        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

                        resolve({
                            symbol: json.meta?.symbol || url.split('symbol=')[1]?.split('&')[0],
                            candles,
                            lastPrice,
                            priceChange,
                            currency: json.meta?.currency || 'USD',
                            exchange: json.meta?.exchange || '',
                            source: 'twelvedata'
                        });
                    } catch (e) {
                        reject(new Error(`Parse error: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Parse TwelveData datetime string to Unix timestamp
     */
    static parseDateTime(dateStr) {
        // TwelveData returns dates like "2024-01-15 14:30:00" or "2024-01-15"
        const date = new Date(dateStr.replace(' ', 'T') + (dateStr.includes(' ') ? '' : 'T00:00:00'));
        return Math.floor(date.getTime() / 1000);
    }

    /**
     * Get current quote for an asset
     */
    static async getQuote(symbol) {
        if (!TWELVE_DATA_API_KEY) {
            throw new Error('TwelveData API key not configured');
        }

        const assetConfig = ASSET_SYMBOLS[symbol];
        if (!assetConfig) {
            throw new Error(`Unknown symbol: ${symbol}`);
        }

        const url = `${TWELVE_DATA_BASE_URL}/quote?symbol=${encodeURIComponent(assetConfig.symbol)}&apikey=${TWELVE_DATA_API_KEY}`;

        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'InsiderTrading/1.0',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        if (json.status === 'error') {
                            reject(new Error(json.message || 'API error'));
                            return;
                        }

                        resolve({
                            symbol,
                            price: parseFloat(json.close),
                            change: parseFloat(json.percent_change) || 0,
                            timestamp: Date.now()
                        });
                    } catch (e) {
                        reject(new Error(`Parse error: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Get real-time price for a token symbol (for Token.js integration)
     */
    static async getTokenPrice(symbol) {
        // Map token symbols to TwelveData format
        const tokenMap = {
            'ETH': 'ETH/USD',
            'BTC': 'BTC/USD',
            'SOL': 'SOL/USD',
            'MATIC': 'MATIC/USD',
            'LINK': 'LINK/USD',
            'UNI': 'UNI/USD',
            'AAVE': 'AAVE/USD',
            'ARB': 'ARB/USD',
            'OP': 'OP/USD',
            'BNB': 'BNB/USD',
            'CRV': 'CRV/USD'
        };

        const twelveDataSymbol = tokenMap[symbol];
        if (!twelveDataSymbol) {
            return null;
        }

        if (!TWELVE_DATA_API_KEY) {
            throw new Error('TwelveData API key not configured');
        }

        const url = `${TWELVE_DATA_BASE_URL}/price?symbol=${encodeURIComponent(twelveDataSymbol)}&apikey=${TWELVE_DATA_API_KEY}`;

        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'InsiderTrading/1.0',
                    'Accept': 'application/json'
                },
                timeout: 10000
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        if (json.status === 'error') {
                            reject(new Error(json.message || 'API error'));
                            return;
                        }

                        resolve({
                            symbol,
                            price: parseFloat(json.price),
                            timestamp: Date.now()
                        });
                    } catch (e) {
                        reject(new Error(`Parse error: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    /**
     * Batch fetch prices for multiple tokens
     */
    static async getBatchTokenPrices(symbols) {
        const results = {};

        // TwelveData supports batch requests - use comma-separated symbols
        const tokenMap = {
            'ETH': 'ETH/USD',
            'BTC': 'BTC/USD',
            'SOL': 'SOL/USD',
            'MATIC': 'MATIC/USD',
            'LINK': 'LINK/USD',
            'UNI': 'UNI/USD',
            'AAVE': 'AAVE/USD',
            'ARB': 'ARB/USD',
            'OP': 'OP/USD',
            'BNB': 'BNB/USD',
            'CRV': 'CRV/USD'
        };

        const validSymbols = symbols.filter(s => tokenMap[s]);
        if (validSymbols.length === 0) {
            return results;
        }

        const twelveDataSymbols = validSymbols.map(s => tokenMap[s]).join(',');

        if (!TWELVE_DATA_API_KEY) {
            throw new Error('TwelveData API key not configured');
        }

        const url = `${TWELVE_DATA_BASE_URL}/price?symbol=${encodeURIComponent(twelveDataSymbols)}&apikey=${TWELVE_DATA_API_KEY}`;

        return new Promise((resolve, reject) => {
            const req = https.get(url, {
                headers: {
                    'User-Agent': 'InsiderTrading/1.0',
                    'Accept': 'application/json'
                },
                timeout: 15000
            }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        // For batch requests, response is keyed by symbol
                        for (const symbol of validSymbols) {
                            const twelveSymbol = tokenMap[symbol];
                            const priceData = json[twelveSymbol];

                            if (priceData && priceData.price) {
                                results[symbol] = parseFloat(priceData.price);
                            }
                        }

                        resolve(results);
                    } catch (e) {
                        reject(new Error(`Parse error: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }
}

module.exports = PriceService;
