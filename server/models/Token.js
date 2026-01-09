// Token data model with simulated price updates

const tokens = [
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: '/assets/tokens/eth.svg',
    decimals: 18,
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    price: 2450.00,
    priceChange24h: 3.24,
    volume24h: 15420000000,
    marketCap: 294000000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base']
  },
  {
    id: 'usd-coin',
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '/assets/tokens/usdc.svg',
    decimals: 6,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    price: 1.00,
    priceChange24h: 0.01,
    volume24h: 8540000000,
    marketCap: 42000000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'base']
  },
  {
    id: 'tether',
    symbol: 'USDT',
    name: 'Tether',
    icon: '/assets/tokens/usdt.svg',
    decimals: 6,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    price: 1.00,
    priceChange24h: -0.02,
    volume24h: 52000000000,
    marketCap: 95000000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon', 'bnb']
  },
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '/assets/tokens/btc.svg',
    decimals: 8,
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    price: 43250.00,
    priceChange24h: 2.15,
    volume24h: 28000000000,
    marketCap: 847000000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon']
  },
  {
    id: 'bnb',
    symbol: 'BNB',
    name: 'BNB',
    icon: '/assets/tokens/bnb.svg',
    decimals: 18,
    address: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52',
    price: 312.50,
    priceChange24h: -1.32,
    volume24h: 1200000000,
    marketCap: 48000000000,
    networks: ['ethereum', 'bnb']
  },
  {
    id: 'arbitrum',
    symbol: 'ARB',
    name: 'Arbitrum',
    icon: '/assets/tokens/arb.svg',
    decimals: 18,
    address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1',
    price: 1.85,
    priceChange24h: 5.67,
    volume24h: 890000000,
    marketCap: 2400000000,
    networks: ['ethereum', 'arbitrum']
  },
  {
    id: 'optimism',
    symbol: 'OP',
    name: 'Optimism',
    icon: '/assets/tokens/op.svg',
    decimals: 18,
    address: '0x4200000000000000000000000000000000000042',
    price: 3.42,
    priceChange24h: 4.21,
    volume24h: 456000000,
    marketCap: 3600000000,
    networks: ['ethereum', 'optimism']
  },
  {
    id: 'polygon',
    symbol: 'MATIC',
    name: 'Polygon',
    icon: '/assets/tokens/matic.svg',
    decimals: 18,
    address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    price: 0.92,
    priceChange24h: -2.15,
    volume24h: 567000000,
    marketCap: 8500000000,
    networks: ['ethereum', 'polygon']
  },
  {
    id: 'chainlink',
    symbol: 'LINK',
    name: 'Chainlink',
    icon: '/assets/tokens/link.svg',
    decimals: 18,
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    price: 14.85,
    priceChange24h: 1.89,
    volume24h: 678000000,
    marketCap: 8700000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon']
  },
  {
    id: 'uniswap',
    symbol: 'UNI',
    name: 'Uniswap',
    icon: '/assets/tokens/uni.svg',
    decimals: 18,
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    price: 7.23,
    priceChange24h: 2.45,
    volume24h: 234000000,
    marketCap: 5400000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon']
  },
  {
    id: 'aave',
    symbol: 'AAVE',
    name: 'Aave',
    icon: '/assets/tokens/aave.svg',
    decimals: 18,
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    price: 98.50,
    priceChange24h: 3.78,
    volume24h: 178000000,
    marketCap: 1450000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon']
  },
  {
    id: 'curve',
    symbol: 'CRV',
    name: 'Curve',
    icon: '/assets/tokens/crv.svg',
    decimals: 18,
    address: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    price: 0.58,
    priceChange24h: -0.85,
    volume24h: 89000000,
    marketCap: 520000000,
    networks: ['ethereum', 'arbitrum', 'optimism', 'polygon']
  }
];

// Simulate price fluctuations
function updatePrices() {
  tokens.forEach(token => {
    // Skip stablecoins
    if (['USDC', 'USDT'].includes(token.symbol)) {
      token.price = 1 + (Math.random() - 0.5) * 0.002; // ±0.1%
      return;
    }

    // Random price change between -0.5% and +0.5%
    const change = (Math.random() - 0.5) * 0.01;
    token.price = token.price * (1 + change);

    // Update 24h change slightly
    token.priceChange24h += (Math.random() - 0.5) * 0.1;
  });
}

// Start price updates
setInterval(updatePrices, 5000);

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
  }
};
