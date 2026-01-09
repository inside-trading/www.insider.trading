const express = require('express');
const router = express.Router();
const Pool = require('../models/Pool');

/**
 * GET /api/pools
 * Get all pools, optionally filtered
 */
router.get('/', (req, res) => {
  try {
    const { network, sortBy, limit } = req.query;

    let pools;
    if (network) {
      pools = Pool.getByNetwork(network);
    } else if (sortBy === 'tvl') {
      pools = Pool.getTopByTvl(parseInt(limit) || 10);
    } else if (sortBy === 'volume') {
      pools = Pool.getTopByVolume(parseInt(limit) || 10);
    } else if (sortBy === 'apr') {
      pools = Pool.getTopByApr(parseInt(limit) || 10);
    } else {
      pools = Pool.getAll();
    }

    res.json({
      success: true,
      data: pools,
      count: pools.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pools/stats
 * Get total platform statistics
 */
router.get('/stats', (req, res) => {
  try {
    const stats = Pool.getTotalStats();
    res.json({
      success: true,
      data: {
        ...stats,
        poolCount: Pool.pools.length,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pools/:id
 * Get pool by ID
 */
router.get('/:id', (req, res) => {
  try {
    const pool = Pool.getById(req.params.id);

    if (!pool) {
      return res.status(404).json({
        success: false,
        error: 'Pool not found'
      });
    }

    res.json({
      success: true,
      data: pool
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pools/pair/:token0/:token1
 * Get pools for a token pair
 */
router.get('/pair/:token0/:token1', (req, res) => {
  try {
    const { token0, token1 } = req.params;
    const pools = Pool.getByTokens(token0.toUpperCase(), token1.toUpperCase());

    res.json({
      success: true,
      data: pools,
      count: pools.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
