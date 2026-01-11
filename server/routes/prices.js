const express = require('express');
const router = express.Router();
const PriceService = require('../services/PriceService');

/**
 * GET /api/prices/:symbol
 * Get historical price data for an asset
 */
router.get('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { window = '1W' } = req.query;

        const data = await PriceService.getHistoricalPrices(symbol, window);

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Price fetch error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/prices/:symbol/quote
 * Get current quote for an asset
 */
router.get('/:symbol/quote', async (req, res) => {
    try {
        const { symbol } = req.params;
        const quote = await PriceService.getQuote(symbol);

        res.json({
            success: true,
            data: quote
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
