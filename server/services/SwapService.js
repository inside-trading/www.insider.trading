// Swap calculation service

const Token = require('../models/Token');
const Pool = require('../models/Pool');
const { v4: uuidv4 } = require('uuid');

// Store pending swaps (in production, this would be in a database)
const pendingSwaps = new Map();

class SwapService {
  /**
   * Get a quote for a swap
   */
  static getQuote(fromToken, toToken, amount, slippage = 0.5) {
    const from = Token.getBySymbol(fromToken);
    const to = Token.getBySymbol(toToken);

    if (!from || !to) {
      throw new Error('Invalid token');
    }

    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Find the best route
    const route = this.findBestRoute(fromToken, toToken);

    // Calculate output amount based on exchange rate
    const rate = from.price / to.price;
    const outputAmount = amount * rate;

    // Calculate price impact (simplified - in production would use pool reserves)
    const priceImpact = this.calculatePriceImpact(amount, from.price, route);

    // Calculate minimum received with slippage
    const minReceived = outputAmount * (1 - slippage / 100);

    // Estimate gas fee (simplified)
    const gasFee = this.estimateGasFee(route);

    return {
      id: uuidv4(),
      fromToken: from,
      toToken: to,
      fromAmount: amount,
      toAmount: outputAmount,
      rate,
      inverseRate: 1 / rate,
      priceImpact,
      slippage,
      minReceived,
      route,
      gasFee,
      gasEstimate: route.length > 1 ? 180000 : 120000,
      expiresAt: Date.now() + 30000, // 30 seconds
      createdAt: Date.now()
    };
  }

  /**
   * Find the best swap route
   */
  static findBestRoute(fromToken, toToken) {
    // Direct route
    const directPools = Pool.getByTokens(fromToken, toToken);

    if (directPools.length > 0) {
      // Sort by liquidity and find best pool
      const bestPool = directPools.sort((a, b) => b.tvl - a.tvl)[0];
      return [{
        pool: bestPool.id,
        poolName: 'Insider V2',
        from: fromToken,
        to: toToken,
        fee: bestPool.fee
      }];
    }

    // Try routing through major tokens (ETH, USDC)
    const intermediates = ['ETH', 'USDC', 'USDT'];

    for (const intermediate of intermediates) {
      if (intermediate === fromToken || intermediate === toToken) continue;

      const firstLeg = Pool.getByTokens(fromToken, intermediate);
      const secondLeg = Pool.getByTokens(intermediate, toToken);

      if (firstLeg.length > 0 && secondLeg.length > 0) {
        return [
          {
            pool: firstLeg[0].id,
            poolName: 'Insider V2',
            from: fromToken,
            to: intermediate,
            fee: firstLeg[0].fee
          },
          {
            pool: secondLeg[0].id,
            poolName: 'Insider V2',
            from: intermediate,
            to: toToken,
            fee: secondLeg[0].fee
          }
        ];
      }
    }

    // Fallback to direct swap (will use virtual pool)
    return [{
      pool: 'virtual',
      poolName: 'Insider V2',
      from: fromToken,
      to: toToken,
      fee: 0.003
    }];
  }

  /**
   * Calculate price impact
   */
  static calculatePriceImpact(amount, fromPrice, route) {
    const tradeValue = amount * fromPrice;

    // Simplified price impact calculation
    // In production, this would use actual pool reserves
    if (tradeValue < 1000) return 0.01;
    if (tradeValue < 10000) return 0.05;
    if (tradeValue < 100000) return 0.15;
    if (tradeValue < 1000000) return 0.5;
    return 1 + (tradeValue / 10000000);
  }

  /**
   * Estimate gas fee in USD
   */
  static estimateGasFee(route) {
    const ethPrice = Token.getPrice('ETH');
    const gasPrice = 25; // gwei
    const gasLimit = route.length > 1 ? 180000 : 120000;

    // Gas fee in ETH
    const gasFeeEth = (gasPrice * gasLimit) / 1e9;

    // Gas fee in USD
    return gasFeeEth * ethPrice;
  }

  /**
   * Create a pending swap
   */
  static createSwap(quote, userAddress) {
    const swap = {
      ...quote,
      userAddress,
      status: 'pending',
      txHash: null,
      confirmedAt: null
    };

    pendingSwaps.set(quote.id, swap);

    // Simulate swap execution
    setTimeout(() => {
      this.executeSwap(quote.id);
    }, 2000);

    return swap;
  }

  /**
   * Execute a pending swap (simulated)
   */
  static executeSwap(swapId) {
    const swap = pendingSwaps.get(swapId);
    if (!swap) return null;

    // Simulate transaction hash
    swap.txHash = '0x' + Array(64).fill(0).map(() =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    swap.status = 'completed';
    swap.confirmedAt = Date.now();

    pendingSwaps.set(swapId, swap);
    return swap;
  }

  /**
   * Get swap by ID
   */
  static getSwap(swapId) {
    return pendingSwaps.get(swapId) || null;
  }

  /**
   * Get user's swap history
   */
  static getUserSwaps(userAddress) {
    return Array.from(pendingSwaps.values())
      .filter(s => s.userAddress === userAddress)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

module.exports = SwapService;
