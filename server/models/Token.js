// Token data model with real-time price updates from TwelveData API

const PriceService = require('../services/PriceService');

// Token metadata (prices are fetched from API)
const tokens = [
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '/assets/tokens/eth.svg',
    decimals: 18,
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base'],
    lastUpdated: null
  },
  {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '/assets/tokens/usdc.svg',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    price: 1.00,  // Stablecoin - pegged to USD
    priceChange24h: 0,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base'],
    lastUpdated: null
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    icon: '/assets/tokens/usdt.svg',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    price: 1.00,  // Stablecoin - pegged to USD
    priceChange24h: 0,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bnb'],
    lastUpdated: null
  },
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '/assets/tokens/btc.svg',
    decimals: 8,
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon'],
    lastUpdated: null
  },
  {
    id: 'bnb',
    symbol: 'BNB',
    name: 'BNB',
    icon: '/assets/tokens/bnb.svg',
    decimals: 18,
    address: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'bnb'],
    lastUpdated: null
  },
  {
    id: 'arbitrum',
    symbol: 'ARB',
    name: 'Arbitrum',
    icon: '/assets/tokens/arb.svg',
    decimals: 18,
    address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum'],
    lastUpdated: null
  },
  {
    id: 'optimism',
    symbol: 'OP',
    name: 'Optimism',
    icon: '/assets/tokens/op.svg',
    decimals: 18,
    address: '0x4200000000000000000000000000000000000042',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'optimism'],
    lastUpdated: null
  },
  {
    id: 'polygon',
    symbol: 'MATIC',
    name: 'Polygon',
    icon: '/assets/tokens/matic.svg',
    decimals: 18,
    address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'polygon'],
    lastUpdated: null
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    icon: '/assets/tokens/link.svg',
    decimals: 18,
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon'],
    lastUpdated: null
  },
  {
    id: 'uniswap',
    symbol: 'UNI',
    name: 'Uniswap',
    icon: '/assets/tokens/uni.svg',
    decimals: 18,
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon'],
    lastUpdated: null
  },
  {
    id: 'aave',
    symbol: 'AAVE',
    name: 'Aave',
    icon: '/assets/tokens/aave.svg',
    decimals: 18,
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon'],
    lastUpdated: null
  },
  {
    id: 'curve',
    symbol: 'CRV',
    name: 'Curve',
    icon: '/assets/tokens/crv.svg',
    decimals: 18,
    address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    price: null,
    priceChange24h: null,
    volume24h: null,
    marketCap: null,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon'],
    lastUpdated: null
  }
];

// Cache for prices (to avoid hitting rate limits)
let priceCache = {};
let lastPriceUpdate = 0;
const PRICE_CACHE_TTL = 30000; // 30 seconds cache

// Fetch real prices from TwelveData API
async function updatePrices() {
  const now = Date.now();

  // Skip if cache is still fresh
  if (now - lastPriceUpdate < PRICE_CACHE_TTL) {
    return;
  }

  try {
    // Get symbols that need price updates (exclude stablecoins)
    const symbolsToFetch = tokens
      .filter(t => !['USDC', 'USDT'].includes(t.symbol))
      .map(t => t.symbol);

    const prices = await PriceService.getBatchTokenPrices(symbolsToFetch);

    // Update token prices
    for (const token of tokens) {
      if (['USDC', 'USDT'].includes(token.symbol)) {
        // Keep stablecoins at $1
        token.price = 1.00;
        token.priceChange24h = 0;
        continue;
      }

      if (prices[token.symbol]) {
        const oldPrice = priceCache[token.symbol];
        const newPrice = prices[token.symbol];

        token.price = newPrice;
        token.lastUpdated = now;

        // Calculate price change if we have old data
        if (oldPrice) {
          const change = ((newPrice - oldPrice) / oldPrice) * 100;
          token.priceChange24h = parseFloat(change.toFixed(2));
        }

        priceCache[token.symbol] = newPrice;
      }
    }

    lastPriceUpdate = now;
    console.log(`[Token] Updated ${Object.keys(prices).length} token prices from TwelveData`);
  } catch (error) {
    console.error('[Token] Failed to update prices:', error.message);
  }
}

// Initial price fetch
updatePrices().catch(console.error);

// Update prices every 30 seconds
setInterval(() => {
  updatePrices().catch(console.error);
}, PRICE_CACHE_TTL);

module.exports = {
  tokens,

  getAll() {
    return tokens;
  },

  getById(id) {
    return tokens.find(t => t.id === id);
  },

  getBySymbol(symbol) {
    return tokens.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
  },

  getByNetwork(network) {
    return tokens.filter(t => t.networks.includes(network));
  },

  search(query) {
    const q = query.toLowerCase();
    return tokens.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );
  },

  getPrice(symbol) {
    const token = this.getBySymbol(symbol);
    return token ? token.price : null;
  },

  getPrices() {
    return tokens.reduce((acc, t) => {
      acc[t.symbol] = {
        price: t.price,
        change24h: t.priceChange24h
      };
      return acc;
    }, {});
  },

  // Force refresh prices (called by API endpoint)
  async refreshPrices() {
    lastPriceUpdate = 0; // Reset cache
    await updatePrices();
    return this.getPrices();
  }
};
