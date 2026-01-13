// Price Service - Fetches historical price data
// Uses Twelve Data API for stocks, crypto, and commodities

const https = require('https');

// Twelve Data API configuration
const TWELVE_DATA_BASE_URL = 'api.twelvedata.com';
const API_KEY = process.env.TWELVE_DATA_API_KEY;

// Window configurations for Twelve Data
// interval options: 1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month
// outputsize must match frontend historicalDays expectations:
// 1D: 30 days * 24 hours * 4 (15min) = 2880
// 1W: 90 days * 24 hours = 2160
// 1M: 180 days
// 1Y: 730 days
// 3Y: 1825 days / 7 = 261 weeks
// 5Y: 2555 days / 7 = 365 weeks
// 10Y: 4380 days / 30 = 146 months
const WINDOW_CONFIG = {
    '1D': { interval: '15min', outputsize: 2880 },
    '1W': { interval: '1h', outputsize: 2160 },
    '1M': { interval: '1day', outputsize: 180 },
    '1Y': { interval: '1day', outputsize: 730 },
    '3Y': { interval: '1week', outputsize: 261 },
    '5Y': { interval: '1week', outputsize: 365 },
    '10Y': { interval: '1month', outputsize: 146 }
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
        if (!API_KEY) {
            throw new Error('TWELVE_DATA_API_KEY is not configured');
        }

        const config = WINDOW_CONFIG[window] || WINDOW_CONFIG['1W'];
        const twelveDataSymbol = ASSET_SYMBOLS[symbol] || symbol;

        const data = await this.fetchTwelveData(symbol, twelveDataSymbol, config.interval, config.outputsize);
        return data;
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
        if (!API_KEY) {
            throw new Error('TWELVE_DATA_API_KEY is not configured');
        }

        const twelveDataSymbol = ASSET_SYMBOLS[symbol] || symbol;
        const data = await this.fetchQuote(twelveDataSymbol);

        return {
            symbol,
            price: data.price,
            change: data.change,
            timestamp: Date.now()
        };
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
            throw new Error('TWELVE_DATA_API_KEY is not configured');
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
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        // Check for API error
                        if (json.status === 'error') {
                            reject(new Error(json.message || 'API error'));
                            return;
                        }

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
                        const results = [];
                        for (let i = 0; i < symbols.length; i++) {
                            const originalSymbol = symbols[i];
                            const twelveSymbol = twelveDataSymbols[i];
                            const quote = json[twelveSymbol];

                            if (!quote || quote.status === 'error') {
                                reject(new Error(`No data for symbol: ${originalSymbol}`));
                                return;
                            }

                            const price = parseFloat(quote.close);
                            const prevClose = parseFloat(quote.previous_close);
                            const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

                            results.push({
                                symbol: originalSymbol,
                                price,
                                change,
                                timestamp: Date.now()
                            });
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

            req.end();
        });
    }

    /**
     * Get batch token prices for Token.js integration
     * @param {string[]} symbols - Array of token symbols (ETH, BTC, etc.)
     * @returns {Object} Object with symbol keys and price values
     */
    static async getBatchTokenPrices(symbols) {
        if (!API_KEY) {
            throw new Error('TWELVE_DATA_API_KEY is not configured');
        }

        const results = {};

        // Map token symbols to TwelveData crypto format
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

        // Filter to supported symbols
        const validSymbols = symbols.filter(s => tokenMap[s]);
        if (validSymbols.length === 0) {
            return results;
        }

        // TwelveData supports batch price requests
        const twelveDataSymbols = validSymbols.map(s => tokenMap[s]).join(',');

        return new Promise((resolve, reject) => {
            const path = `/price?symbol=${encodeURIComponent(twelveDataSymbols)}&apikey=${API_KEY}`;

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
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);

                        // Handle single symbol response
                        if (json.price !== undefined) {
                            results[validSymbols[0]] = parseFloat(json.price);
                            resolve(results);
                            return;
                        }

                        // Handle multiple symbols - response is keyed by symbol
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

            req.end();
        });
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
