const express = require('express');
const router = express.Router();
const PredictionService = require('../services/PredictionService');

/**
 * GET /api/predictions
 * Get all predictions (optionally filtered by user)
 */
router.get('/', (req, res) => {
    try {
        const { user, status } = req.query;

        let predictions;
        if (user) {
            predictions = PredictionService.getByUser(user);
        } else {
            predictions = PredictionService.getAll();
        }

        if (status) {
            predictions = predictions.filter(p => p.status === status);
        }

        res.json({
            success: true,
            data: predictions,
            count: predictions.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/predictions/:id
 * Get prediction by ID
 */
router.get('/:id', (req, res) => {
    try {
        const prediction = PredictionService.getById(req.params.id);

        if (!prediction) {
            return res.status(404).json({
                success: false,
                error: 'Prediction not found'
            });
        }

        res.json({
            success: true,
            data: prediction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/predictions
 * Create a new prediction
 */
router.post('/', (req, res) => {
    try {
        const {
            asset,
            assetName,
            window,
            windowLabel,
            startPrice,
            predictedPrice,
            stake,
            userAddress,
            drawingPath
        } = req.body;

        // Validate required fields
        if (!asset || !startPrice || !predictedPrice || !stake) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const prediction = PredictionService.create({
            asset,
            assetName,
            window,
            windowLabel,
            startPrice,
            predictedPrice,
            stake,
            userAddress,
            drawingPath
        });

        res.status(201).json({
            success: true,
            data: prediction
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/predictions/:id/settle
 * Settle a prediction (calculate result)
 */
router.post('/:id/settle', async (req, res) => {
    try {
        const result = await PredictionService.settle(req.params.id);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Prediction not found'
            });
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/predictions/leaderboard
 * Get prediction leaderboard
 */
router.get('/stats/leaderboard', (req, res) => {
    try {
        const leaderboard = PredictionService.getLeaderboard();

        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
