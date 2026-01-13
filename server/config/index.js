module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  ws: {
    priceUpdateInterval: 5000, // 5 seconds
    heartbeatInterval: 30000 // 30 seconds
  },
  twelveData: {
    apiKey: process.env.TWELVE_DATA_API_KEY,
    baseUrl: 'api.twelvedata.com'
  }
};
