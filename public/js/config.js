// ================================================
// Frontend Configuration
// ================================================

const CONFIG = {
    // API Base URL - Update this after deploying backend to Railway
    // For local development: '/api'
    // For production: 'https://your-app.up.railway.app/api'
    API_BASE: '/api',

    // Set to true when backend is deployed separately
    USE_EXTERNAL_API: false,

    // Testnet configuration
    DEFAULT_NETWORK: 'sepolia',

    // Feature flags
    FEATURES: {
        LIVE_PRICES: true,
        ON_CHAIN_PREDICTIONS: true,
        MOCK_FALLBACK: true
    }
};

// Auto-detect production environment
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // In production on Vercel, use the Railway backend URL
    // UPDATE THIS after deploying to Railway:
    // CONFIG.API_BASE = 'https://your-railway-app.up.railway.app/api';
    // CONFIG.USE_EXTERNAL_API = true;
}

// Export for use in other scripts
window.CONFIG = CONFIG;
