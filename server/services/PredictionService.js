// Prediction Service - Manages predictions and scoring
const { v4: uuidv4 } = require('uuid');
const PriceService = require('./PriceService');

// In-memory storage (would use database in production)
const predictions = new Map();

// Scoring tiers for payoff calculation
const SCORING_TIERS = [
    { maxError: 1, multiplier: 10 },    // ±1% = 10x
    { maxError: 2.5, multiplier: 5 },   // ±2.5% = 5x
    { maxError: 5, multiplier: 2 },     // ±5% = 2x
    { maxError: 10, multiplier: 1 },    // ±10% = 1x
    { maxError: Infinity, multiplier: 0 } // >10% = 0x
];

// Window durations in milliseconds
const WINDOW_DURATIONS = {
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
    '1Y': 365 * 24 * 60 * 60 * 1000,
    '3Y': 3 * 365 * 24 * 60 * 60 * 1000,
    '5Y': 5 * 365 * 24 * 60 * 60 * 1000,
    '10Y': 10 * 365 * 24 * 60 * 60 * 1000
};

class PredictionService {
    /**
     * Create a new prediction
     */
    static create(data) {
        const id = uuidv4();
        const now = new Date();
        const windowDuration = WINDOW_DURATIONS[data.window] || WINDOW_DURATIONS['1W'];
        const endsAt = new Date(now.getTime() + windowDuration);

        const prediction = {
            id,
            asset: data.asset,
            assetName: data.assetName || data.asset,
            window: data.window,
            windowLabel: data.windowLabel || data.window,
            startPrice: data.startPrice,
            predictedPrice: data.predictedPrice,
            predictedChange: ((data.predictedPrice - data.startPrice) / data.startPrice) * 100,
            stake: data.stake,
            userAddress: data.userAddress || 'anonymous',
            drawingPath: data.drawingPath || [],
            createdAt: now.toISOString(),
            endsAt: endsAt.toISOString(),
            status: 'pending',
            actualPrice: null,
            actualChange: null,
            errorPercent: null,
            multiplier: null,
            payout: null,
            settledAt: null
        };

        predictions.set(id, prediction);

        // Schedule settlement check
        this.scheduleSettlement(id, windowDuration);

        return prediction;
    }

    /**
     * Schedule prediction settlement
     */
    static scheduleSettlement(id, duration) {
        // In production, this would use a job queue
        // For demo, we'll check periodically
        setTimeout(() => {
            this.settle(id);
        }, Math.min(duration, 60000)); // Check after duration or 1 minute for demo
    }

    /**
     * Settle a prediction
     */
    static async settle(id) {
        const prediction = predictions.get(id);
        if (!prediction || prediction.status !== 'pending') {
            return prediction;
        }

        try {
            // Get current price
            const quote = await PriceService.getQuote(prediction.asset);
            const actualPrice = quote.price;

            // Calculate actual change
            const actualChange = ((actualPrice - prediction.startPrice) / prediction.startPrice) * 100;

            // Calculate prediction error
            const errorPercent = Math.abs(prediction.predictedChange - actualChange);

            // Determine multiplier based on accuracy
            const tier = SCORING_TIERS.find(t => errorPercent <= t.maxError);
            const multiplier = tier ? tier.multiplier : 0;

            // Calculate payout
            const payout = prediction.stake * multiplier;

            // Update prediction
            prediction.status = payout > 0 ? 'won' : 'lost';
            prediction.actualPrice = actualPrice;
            prediction.actualChange = actualChange;
            prediction.errorPercent = errorPercent;
            prediction.multiplier = multiplier;
            prediction.payout = payout;
            prediction.settledAt = new Date().toISOString();

            predictions.set(id, prediction);

            return prediction;
        } catch (error) {
            console.error('Settlement error:', error);
            return prediction;
        }
    }

    /**
     * Get prediction by ID
     */
    static getById(id) {
        return predictions.get(id) || null;
    }

    /**
     * Get all predictions
     */
    static getAll() {
        return Array.from(predictions.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get predictions by user
     */
    static getByUser(userAddress) {
        return Array.from(predictions.values())
            .filter(p => p.userAddress === userAddress)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get pending predictions
     */
    static getPending() {
        return Array.from(predictions.values())
            .filter(p => p.status === 'pending')
            .sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt));
    }

    /**
     * Get leaderboard
     */
    static getLeaderboard() {
        const settled = Array.from(predictions.values())
            .filter(p => p.status !== 'pending');

        // Aggregate by user
        const userStats = {};

        settled.forEach(pred => {
            const user = pred.userAddress;
            if (!userStats[user]) {
                userStats[user] = {
                    address: user,
                    totalPredictions: 0,
                    wins: 0,
                    losses: 0,
                    totalStaked: 0,
                    totalPayout: 0,
                    profit: 0,
                    avgAccuracy: 0,
                    accuracySum: 0
                };
            }

            userStats[user].totalPredictions++;
            userStats[user].totalStaked += pred.stake;
            userStats[user].totalPayout += pred.payout || 0;

            if (pred.status === 'won') {
                userStats[user].wins++;
            } else {
                userStats[user].losses++;
            }

            if (pred.errorPercent !== null) {
                userStats[user].accuracySum += (100 - Math.min(pred.errorPercent, 100));
            }
        });

        // Calculate final stats
        return Object.values(userStats)
            .map(user => ({
                ...user,
                profit: user.totalPayout - user.totalStaked,
                winRate: user.totalPredictions > 0
                    ? ((user.wins / user.totalPredictions) * 100).toFixed(1)
                    : 0,
                avgAccuracy: user.totalPredictions > 0
                    ? (user.accuracySum / user.totalPredictions).toFixed(1)
                    : 0
            }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 100);
    }

    /**
     * Calculate potential payout for a prediction
     */
    static calculatePotentialPayout(stake, predictedChange) {
        // For display purposes, show max potential
        return {
            tiers: SCORING_TIERS.map(tier => ({
                errorRange: tier.maxError === Infinity ? '>10%' : `±${tier.maxError}%`,
                multiplier: tier.multiplier,
                payout: stake * tier.multiplier
            })),
            maxPayout: stake * 10
        };
    }
}

module.exports = PredictionService;
