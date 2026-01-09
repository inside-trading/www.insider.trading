require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');

const config = require('./config');
const routes = require('./routes');
const { errorHandler, requestLogger } = require('./middleware/errorHandler');
const WebSocketService = require('./services/WebSocketService');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize WebSocket
const wsService = new WebSocketService(server);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
});
app.use('/api', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
if (config.env !== 'production') {
  app.use(requestLogger);
}

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', routes);

// WebSocket stats endpoint
app.get('/api/ws/stats', (req, res) => {
  res.json({
    success: true,
    data: wsService.getStats()
  });
});

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling
app.use(errorHandler);

// Start server
server.listen(config.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Insider Trading DEX Server                           ║
║                                                           ║
║   Environment: ${config.env.padEnd(40)}║
║   Server:      http://localhost:${String(config.port).padEnd(26)}║
║   WebSocket:   ws://localhost:${config.port}/ws${' '.repeat(23)}║
║                                                           ║
║   API Endpoints:                                          ║
║   • GET  /api/health         - Health check               ║
║   • GET  /api/tokens         - List all tokens            ║
║   • GET  /api/tokens/prices  - Get token prices           ║
║   • GET  /api/pools          - List liquidity pools       ║
║   • GET  /api/pools/stats    - Platform statistics        ║
║   • POST /api/swap/quote     - Get swap quote             ║
║   • POST /api/swap/execute   - Execute swap               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };
