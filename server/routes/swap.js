const express = require('express');
const router = express.Router();
const SwapService = require('../services/SwapService');

/**
 * POST /api/swap/quote
 * Get a swap quote
 */
router.post('/quote', (req, res) => {
  try {
    const { fromToken, toToken, amount, slippage } = req.body;

    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromToken, toToken, amount'
      });
    }

    const quote = SwapService.getQuote(
      fromToken,
      toToken,
      parseFloat(amount),
      slippage || 0.5
    );

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/swap/quote
 * Get a swap quote (GET method for convenience)
 */
router.get('/quote', (req, res) => {
  try {
    const { fromToken, toToken, amount, slippage } = req.query;

    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query params: fromToken, toToken, amount'
      });
    }

    const quote = SwapService.getQuote(
      fromToken,
      toToken,
      parseFloat(amount),
      parseFloat(slippage) || 0.5
    );

    res.json({
      success: true,
      data: quote
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/swap/execute
 * Execute a swap (simulated)
 */
router.post('/execute', (req, res) => {
  try {
    const { quoteId, fromToken, toToken, amount, slippage, userAddress } = req.body;

    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: 'User address is required'
      });
    }

    // Get or create quote
    let quote;
    if (quoteId) {
      quote = SwapService.getSwap(quoteId);
      if (!quote) {
        return res.status(400).json({
          success: false,
          error: 'Quote expired or not found'
        });
      }
    } else {
      if (!fromToken || !toToken || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }
      quote = SwapService.getQuote(fromToken, toToken, parseFloat(amount), slippage || 0.5);
    }

    // Create and execute swap
    const swap = SwapService.createSwap(quote, userAddress);

    res.json({
      success: true,
      data: swap
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/swap/:id
 * Get swap status
 */
router.get('/:id', (req, res) => {
  try {
    const swap = SwapService.getSwap(req.params.id);

    if (!swap) {
      return res.status(404).json({
        success: false,
        error: 'Swap not found'
      });
    }

    res.json({
      success: true,
      data: swap
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/swap/history/:address
 * Get user's swap history
 */
router.get('/history/:address', (req, res) => {
  try {
    const swaps = SwapService.getUserSwaps(req.params.address);

    res.json({
      success: true,
      data: swaps,
      count: swaps.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
