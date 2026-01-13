/**
 * Vercel Web Analytics Utility
 * Provides helper functions for tracking custom events in the Insider Trading DEX
 */

/**
 * Track a custom event using Vercel Web Analytics
 * @param {string} eventName - The name of the event to track
 * @param {Object} properties - Optional event properties
 */
function trackEvent(eventName, properties = {}) {
  if (window.va) {
    window.va('event', {
      name: eventName,
      ...properties,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Track swap transactions
 * @param {Object} swapData - Swap transaction data
 */
function trackSwap(swapData) {
  trackEvent('swap', {
    fromToken: swapData.fromToken,
    toToken: swapData.toToken,
    amount: swapData.amount,
    slippage: swapData.slippage
  });
}

/**
 * Track wallet connections
 * @param {string} walletType - Type of wallet connected
 * @param {string} address - Wallet address (masked for privacy)
 */
function trackWalletConnect(walletType, address) {
  const maskedAddress = address ? `${address.substring(0, 6)}...${address.substring(-4)}` : 'unknown';
  trackEvent('wallet_connected', {
    walletType,
    address: maskedAddress
  });
}

/**
 * Track pool interactions
 * @param {Object} poolData - Pool interaction data
 */
function trackPoolInteraction(poolData) {
  trackEvent('pool_interaction', {
    poolId: poolData.poolId,
    action: poolData.action, // 'add_liquidity', 'remove_liquidity'
    amount: poolData.amount
  });
}

/**
 * Track prediction submissions
 * @param {Object} predictionData - Prediction data
 */
function trackPrediction(predictionData) {
  trackEvent('prediction_submitted', {
    asset: predictionData.asset,
    expiryDate: predictionData.expiryDate,
    confidence: predictionData.confidence
  });
}

/**
 * Track page views with custom properties
 * @param {string} pageName - Name of the page
 * @param {Object} properties - Optional page properties
 */
function trackPageView(pageName, properties = {}) {
  trackEvent('page_view', {
    page: pageName,
    ...properties
  });
}

/**
 * Track error events for debugging
 * @param {string} errorMessage - Description of the error
 * @param {string} errorCode - Optional error code
 */
function trackError(errorMessage, errorCode = 'unknown') {
  trackEvent('error', {
    message: errorMessage,
    code: errorCode
  });
}

/**
 * Initialize analytics on page load
 */
function initializeAnalytics() {
  // Track initial page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      trackPageView(document.title);
    });
  } else {
    trackPageView(document.title);
  }

  // Track navigation between sections
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (link) {
      const sectionId = link.getAttribute('href').substring(1);
      trackEvent('section_navigation', {
        section: sectionId
      });
    }
  });
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAnalytics);
} else {
  initializeAnalytics();
}
