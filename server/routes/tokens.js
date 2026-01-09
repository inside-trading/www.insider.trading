const express = require('express');
const router = express.Router();
const Token = require('../models/Token');

/**
 * GET /api/tokens
 * Get all tokens, optionally filtered by network
 */
router.get('/', (req, res) => {
  try {
    const { network, search } = req.query;

    let tokens;
    if (search) {
      tokens = Token.search(search);
    } else if (network) {
      tokens = Token.getByNetwork(network);
    } else {
      tokens = Token.getAll();
    }

    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tokens/prices
 * Get all token prices
 */
router.get('/prices', (req, res) => {
  try {
    const prices = Token.getPrices();
    res.json({
      success: true,
      data: prices,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tokens/:id
 * Get token by ID
 */
router.get('/:id', (req, res) => {
  try {
    const token = Token.getById(req.params.id);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/tokens/symbol/:symbol
 * Get token by symbol
 */
router.get('/symbol/:symbol', (req, res) => {
  try {
    const token = Token.getBySymbol(req.params.symbol);

    if (!token) {
      return res.status(404).json({
        success: false,
        error: 'Token not found'
      });
    }

    res.json({
      success: true,
      data: token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
