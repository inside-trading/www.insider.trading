const express = require('express');
const router = express.Router();

const tokensRouter = require('./tokens');
const poolsRouter = require('./pools');
const swapRouter = require('./swap');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// API routes
router.use('/tokens', tokensRouter);
router.use('/pools', poolsRouter);
router.use('/swap', swapRouter);

// 404 handler for API
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

module.exports = router;
