// Liquidity Pool data model

const Token = require('./Token');

const pools = [
  {
    id: 'eth-usdc-030',
    token0: 'ETH',
    token1: 'USDC',
    fee: 0.003, // 0.3%
    tvl: 542800000,
    volume24h: 128400000,
    volume7d: 892000000,
    fees24h: 385200,
    apr: 24.5,
    token0Reserve: 221755,
    token1Reserve: 543300000,
    network: 'ethereum'
  },
  {
    id: 'eth-usdt-030',
    token0: 'ETH',
    token1: 'USDT',
    fee: 0.003,
    tvl: 312500000,
    volume24h: 89200000,
    volume7d: 624000000,
    fees24h: 267600,
    apr: 18.2,
    token0Reserve: 127551,
    token1Reserve: 312500000,
    network: 'ethereum'
  },
  {
    id: 'btc-eth-030',
    token0: 'BTC',
    token1: 'ETH',
    fee: 0.003,
    tvl: 256100000,
    volume24h: 67800000,
    volume7d: 475000000,
    fees24h: 203400,
    apr: 15.8,
    token0Reserve: 2963,
    token1Reserve: 52265,
    network: 'ethereum'
  },
  {
    id: 'eth-arb-030',
    token0: 'ETH',
    token1: 'ARB',
    fee: 0.003,
    tvl: 124700000,
    volume24h: 45300000,
    volume7d: 317000000,
    fees24h: 135900,
    apr: 32.4,
    token0Reserve: 25449,
    token1Reserve: 33702703,
    network: 'arbitrum'
  },
  {
    id: 'usdc-usdt-005',
    token0: 'USDC',
    token1: 'USDT',
    fee: 0.0005, // 0.05%
    tvl: 98400000,
    volume24h: 234500000,
    volume7d: 1640000000,
    fees24h: 117250,
    apr: 8.2,
    token0Reserve: 49200000,
    token1Reserve: 49200000,
    network: 'ethereum'
  },
  {
    id: 'eth-op-030',
    token0: 'ETH',
    token1: 'OP',
    fee: 0.003,
    tvl: 78500000,
    volume24h: 32100000,
    volume7d: 224700000,
    fees24h: 96300,
    apr: 28.6,
    token0Reserve: 16020,
    token1Reserve: 11461988,
    network: 'optimism'
  },
  {
    id: 'eth-matic-030',
    token0: 'ETH',
    token1: 'MATIC',
    fee: 0.003,
    tvl: 65200000,
    volume24h: 28400000,
    volume7d: 198800000,
    fees24h: 85200,
    apr: 22.4,
    token0Reserve: 13306,
    token1Reserve: 35434783,
    network: 'polygon'
  },
  {
    id: 'link-eth-030',
    token0: 'LINK',
    token1: 'ETH',
    fee: 0.003,
    tvl: 45600000,
    volume24h: 18200000,
    volume7d: 127400000,
    fees24h: 54600,
    apr: 19.8,
    token0Reserve: 1535354,
    token1Reserve: 9306,
    network: 'ethereum'
  },
  {
    id: 'uni-eth-030',
    token0: 'UNI',
    token1: 'ETH',
    fee: 0.003,
    tvl: 38900000,
    volume24h: 14500000,
    volume7d: 101500000,
    fees24h: 43500,
    apr: 17.2,
    token0Reserve: 2689903,
    token1Reserve: 7939,
    network: 'ethereum'
  },
  {
    id: 'aave-eth-030',
    token0: 'AAVE',
    token1: 'ETH',
    fee: 0.003,
    tvl: 28700000,
    volume24h: 9800000,
    volume7d: 68600000,
    fees24h: 29400,
    apr: 14.5,
    token0Reserve: 145685,
    token1Reserve: 5857,
    network: 'ethereum'
  }
];

// Simulate TVL and volume changes
function updatePoolStats() {
  pools.forEach(pool => {
    // Random TVL change between -0.2% and +0.2%
    const tvlChange = (Math.random() - 0.5) * 0.004;
    pool.tvl = pool.tvl * (1 + tvlChange);

    // Random volume change between -1% and +1%
    const volumeChange = (Math.random() - 0.5) * 0.02;
    pool.volume24h = pool.volume24h * (1 + volumeChange);

    // Recalculate fees
    pool.fees24h = pool.volume24h * pool.fee;

    // Recalculate APR based on fees and TVL
    pool.apr = (pool.fees24h * 365 / pool.tvl) * 100;
  });
}

setInterval(updatePoolStats, 10000);

module.exports = {
  pools,

  getAll() {
    return pools.map(pool => ({
      ...pool,
      token0Data: Token.getBySymbol(pool.token0),
      token1Data: Token.getBySymbol(pool.token1)
    }));
  },

  getById(id) {
    const pool = pools.find(p => p.id === id);
    if (!pool) return null;
    return {
      ...pool,
      token0Data: Token.getBySymbol(pool.token0),
      token1Data: Token.getBySymbol(pool.token1)
    };
  },

  getByTokens(token0, token1) {
    return pools.filter(p =>
      (p.token0 === token0 && p.token1 === token1) ||
      (p.token0 === token1 && p.token1 === token0)
    ).map(pool => ({
      ...pool,
      token0Data: Token.getBySymbol(pool.token0),
      token1Data: Token.getBySymbol(pool.token1)
    }));
  },

  getByNetwork(network) {
    return pools.filter(p => p.network === network).map(pool => ({
      ...pool,
      token0Data: Token.getBySymbol(pool.token0),
      token1Data: Token.getBySymbol(pool.token1)
    }));
  },

  getTopByTvl(limit = 10) {
    return [...pools]
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, limit)
      .map(pool => ({
        ...pool,
        token0Data: Token.getBySymbol(pool.token0),
        token1Data: Token.getBySymbol(pool.token1)
      }));
  },

  getTopByVolume(limit = 10) {
    return [...pools]
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, limit)
      .map(pool => ({
        ...pool,
        token0Data: Token.getBySymbol(pool.token0),
        token1Data: Token.getBySymbol(pool.token1)
      }));
  },

  getTopByApr(limit = 10) {
    return [...pools]
      .sort((a, b) => b.apr - a.apr)
      .slice(0, limit)
      .map(pool => ({
        ...pool,
        token0Data: Token.getBySymbol(pool.token0),
        token1Data: Token.getBySymbol(pool.token1)
      }));
  },

  getTotalStats() {
    return pools.reduce((acc, pool) => {
      acc.totalTvl += pool.tvl;
      acc.totalVolume24h += pool.volume24h;
      acc.totalFees24h += pool.fees24h;
      return acc;
    }, { totalTvl: 0, totalVolume24h: 0, totalFees24h: 0 });
  }
};
