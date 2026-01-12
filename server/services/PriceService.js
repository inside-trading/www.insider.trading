// Price Service - Fetches historical price data
// Uses Twelve Data API for stocks, crypto, and commodities

const https = require('https');

// Twelve Data API configuration
const TWELVE_DATA_BASE_URL = 'api.twelvedata.com';
const API_KEY = process.env.TWELVE_DATA_API_KEY;

// Window configurations for Twelve Data
// interval options: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month
const WINDOW_CONFIG = {
    '1D': { interval: '15min', outputsize: 96 },
    '1W': { interval: '1h', outputsize: 168 },
    '1M': { interval: '1day', outputsize: 30 },
    '1Y': { interval: '1day', outputsize: 365 },
    '3Y': { interval: '1week', outputsize: 156 },
    '5Y': { interval: '1week', outputsize: 260 },
    '10Y': { interval: '1month', outputsize: 120 }
};

// Asset symbol mappings for Twelve Data
// Stocks use their ticker directly
// Crypto uses /USD suffix
// Commodities use forex-style symbols
const ASSET_SYMBOLS = {
    // Stocks (ETFs and individual)
    'SPY': 'SPY',
    'QQQ': 'QQQ',
    'AAPL': 'AAPL',
    'TSLA': 'TSLA',
    'MSFT': 'MSFT',
    'GOOGL': 'GOOGL',
    'AMZN': 'AMZN',
    'NVDA': 'NVDA',
    'META': 'META',
    // Crypto
    'BTC-USD': 'BTC/USD',
    'ETH-USD': 'ETH/USD',
    'SOL-USD': 'SOL/USD',
    // Commodities
    'GC=F': 'XAU/USD',   // Gold
    'SI=F': 'XAG/USD',   // Silver
    'CL=F': 'WTI/USD'    // Crude Oil (WTI)
};

// Asset type detection for proper API endpoint usage
const ASSET_TYPES = {
    'SPY': 'stock', 'QQQ': 'stock', 'AAPL': 'stock', 'TSLA': 'stock',
    'MSFT': 'stock', 'GOOGL': 'stock', 'AMZN': 'stock', 'NVDA': 'stock', 'META': 'stock',
    'BTC-USD': 'crypto', 'ETH-USD': 'crypto', 'SOL-USD': 'crypto',
    'GC=F': 'commodity', 'SI=F': 'commodity', 'CL=F': 'commodity'
};

class PriceService {
    /**
     * Get historical prices for an asset
     */
    static async getHistoricalPrices(symbol, window = '1W') {
        const config = WINDOW_CONFIG[window] || WINDOW_CONFIG['1W'];
        const twelveDataSymbol = ASSET_SYMBOLS[symbol] || symbol;

        if (!API_KEY) {
            console.warn('TWELVE_DATA_API_KEY not set, using mock data');
            return this.generateMockData(symbol, window);
        }

        try {
            const data = await this.fetchTwelveData(symbol, twelveDataSymbol, config.interval, config.outputsize);
            return data;
        } catch (error) {
            console.error('Twelve Data API error:', error.message);
            // Return mock data as fallback
            return this.generateMockData(symbol, window);
        }
    }

    /**
     * Fetch data from Twelve Data API with retry logic
     */
    static async fetchTwelveData(originalSymbol, twelveDataSymbol, interval, outputsize, retries = 3) {
        let lastError = null;

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const result = await this.fetchWithTimeout(twelveDataSymbol, interval, outputsize);
                // Map back to original symbol for consistency
                result.symbol = originalSymbol;
                return result;
            } catch (error) {
                lastError = error;
                console.log(`Attempt ${attempt + 1} failed for ${originalSymbol}: ${error.message}`);
                // Wait before retry (exponential backoff)
                if (attempt < retries - 1) {
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
                }
            }
        }

        throw lastError || new Error('All fetch attempts failed');
    }

    /**
     * Fetch time series data with timeout
     */
    static fetchWithTimeout(symbol, interval, outputsize, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const path = `/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${API_KEY}`;

            const options = {
                hostname: TWELVE_DATA_BASE_URL,
                path: path,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout
            };

            const req = https.request(options, (res) => {
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

                        if (!json.values || json.values.length === 0) {
                            reject(new Error('No data returned'));
                            return;
                        }

                        // Twelve Data returns newest first, we need oldest first
                        const values = json.values.reverse();

                        // Convert to candle format
                        const candles = values.map(v => ({
                            time: Math.floor(new Date(v.datetime).getTime() / 1000),
                            open: parseFloat(v.open),
                            high: parseFloat(v.high),
                            low: parseFloat(v.low),
                            close: parseFloat(v.close),
                            volume: parseInt(v.volume) || 0
                        })).filter(c =>
                            !isNaN(c.open) && !isNaN(c.close) &&
                            c.open > 0 && c.close > 0
                        );

                        if (candles.length < 5) {
                            reject(new Error('Insufficient valid data points'));
                            return;
                        }

                        const lastPrice = candles[candles.length - 1].close;
                        const firstPrice = candles[0].open;
                        const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

                        resolve({
                            symbol: json.meta?.symbol || symbol,
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

            req.end();
        });
    }

    /**
     * Get current quote for an asset
     */
    static async getQuote(symbol) {
        const twelveDataSymbol = ASSET_SYMBOLS[symbol] || symbol;

        if (!API_KEY) {
            return this.generateMockQuote(symbol);
        }

        try {
            const data = await this.fetchQuote(twelveDataSymbol);
            return {
                symbol,
                price: data.price,
                change: data.change,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Quote fetch error:', error.message);
            // Return mock quote as fallback
            return this.generateMockQuote(symbol);
        }
    }

    /**
     * Fetch real-time quote from Twelve Data
     */
    static fetchQuote(symbol, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const path = `/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;

            const options = {
                hostname: TWELVE_DATA_BASE_URL,
                path: path,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout
            };

            const req = https.request(options, (res) => {
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

                        const price = parseFloat(json.close);
                        const prevClose = parseFloat(json.previous_close);
                        const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

                        resolve({
                            price,
                            change,
                            open: parseFloat(json.open),
                            high: parseFloat(json.high),
                            low: parseFloat(json.low),
                            volume: parseInt(json.volume) || 0
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

            req.end();
        });
    }

    /**
     * Get multiple quotes at once (more efficient for rate limits)
     */
    static async getMultipleQuotes(symbols) {
        if (!API_KEY) {
            return symbols.map(s => this.generateMockQuote(s));
        }

        const twelveDataSymbols = symbols.map(s => ASSET_SYMBOLS[s] || s);
        const symbolsParam = twelveDataSymbols.join(',');

        return new Promise((resolve, reject) => {
            const path = `/quote?symbol=${encodeURIComponent(symbolsParam)}&apikey=${API_KEY}`;

            const options = {
                hostname: TWELVE_DATA_BASE_URL,
                path: path,
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout: 15000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        // Handle single symbol response (not array)
                        if (!Array.isArray(json) && json.symbol) {
                            const price = parseFloat(json.close);
                            const prevClose = parseFloat(json.previous_close);
                            const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
                            resolve([{
                                symbol: symbols[0],
                                price,
                                change,
                                timestamp: Date.now()
                            }]);
                            return;
                        }

                        // Handle multiple symbols - response is keyed by symbol
                        const results = symbols.map((originalSymbol, i) => {
                            const twelveSymbol = twelveDataSymbols[i];
                            const quote = json[twelveSymbol];

                            if (!quote || quote.status === 'error') {
                                return this.generateMockQuote(originalSymbol);
                            }

                            const price = parseFloat(quote.close);
                            const prevClose = parseFloat(quote.previous_close);
                            const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

                            return {
                                symbol: originalSymbol,
                                price,
                                change,
                                timestamp: Date.now()
                            };
                        });

                        resolve(results);
                    } catch (e) {
                        // Fallback to mock data on parse error
                        resolve(symbols.map(s => this.generateMockQuote(s)));
                    }
                });
            });

            req.on('error', () => {
                resolve(symbols.map(s => this.generateMockQuote(s)));
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(symbols.map(s => this.generateMockQuote(s)));
            });

            req.end();
        });
    }

    /**
     * Generate mock data as fallback
     */
    static generateMockData(symbol, window) {
        const config = WINDOW_CONFIG[window] || WINDOW_CONFIG['1W'];

        const numCandles = config.outputsize || 100;

        // Base prices for different assets
        const basePrices = {
            'SPY': 450, 'QQQ': 380, 'AAPL': 175, 'TSLA': 250,
            'MSFT': 380, 'GOOGL': 140, 'AMZN': 175, 'NVDA': 480,
            'META': 350, 'BTC-USD': 43000, 'ETH-USD': 2400,
            'SOL-USD': 100, 'GC=F': 2000, 'SI=F': 24, 'CL=F': 75
        };

        let price = basePrices[symbol] || 100;
        const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL');
        const volatility = isCrypto ? 0.03 : 0.012;

        const candles = [];
        const now = Date.now();

        // Calculate time interval in ms
        const intervalMs = {
            '15min': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '1day': 24 * 60 * 60 * 1000,
            '1week': 7 * 24 * 60 * 60 * 1000,
            '1month': 30 * 24 * 60 * 60 * 1000
        };

        const interval = intervalMs[config.interval] || intervalMs['1day'];

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
            exchange: 'Mock',
            source: 'mock'
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
            'SOL-USD': 100, 'GC=F': 2000, 'SI=F': 24, 'CL=F': 75
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

    /**
     * Get supported symbols list
     */
    static getSupportedSymbols() {
        return Object.keys(ASSET_SYMBOLS);
    }

    /**
     * Get asset type (stock, crypto, commodity)
     */
    static getAssetType(symbol) {
        return ASSET_TYPES[symbol] || 'unknown';
    }
}

module.exports = PriceService;
