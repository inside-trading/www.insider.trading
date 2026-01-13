// ================================================
// Frontend Configuration
// ================================================

const CONFIG = {
    // API Base URL - defaults to relative path for local development
    API_BASE: '/api',

    // Railway backend URL for production
    RAILWAY_API_BASE: 'https://wwwinsidertrading-production.up.railway.app/api',

    // Set to true when backend is deployed separately
    USE_EXTERNAL_API: false,

    // Testnet configuration
    DEFAULT_NETWORK: 'sepolia',

    // Feature flags
    FEATURES: {
        LIVE_PRICES: true,
        ON_CHAIN_PREDICTIONS: true
    }
};

// Auto-detect production environment (Vercel serves static files only)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // In production on Vercel, use the Railway backend URL
    CONFIG.API_BASE = CONFIG.RAILWAY_API_BASE;
    CONFIG.USE_EXTERNAL_API = true;
}

// Export for use in other scripts
window.CONFIG = CONFIG;
