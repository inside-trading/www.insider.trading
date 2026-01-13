# Vercel Web Analytics Integration

This project uses Vercel Web Analytics to track user interactions and page performance metrics.

## Overview

Vercel Web Analytics is integrated into the Insider Trading DEX application to provide insights into:
- User traffic and page views
- Core Web Vitals (page load performance)
- Custom user interactions (swaps, wallet connections, pool interactions, etc.)
- User behavior patterns and navigation

## Setup

### Prerequisites

- A Vercel account and project (already configured)
- `@vercel/analytics` package (already installed, version ^1.6.1)

### Current Implementation

The application uses the **HTML/Static Site implementation** of Vercel Web Analytics because:
1. The application serves static HTML files with a Node.js/Express backend
2. This approach provides automatic tracking without framework-specific dependencies
3. Route support is handled through custom event tracking in `js/analytics.js`

## Components

### 1. Core Analytics Scripts (in HTML head)

Located in `public/index.html` and `public/predictions.html`:

```html
<!-- Window.va initialization for fallback -->
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>

<!-- Vercel Insights tracking script -->
<script defer src="/_vercel/insights/script.js"></script>

<!-- Custom analytics utilities -->
<script defer src="js/analytics.js"></script>
```

### 2. Custom Analytics Utilities (`public/js/analytics.js`)

Provides helper functions for tracking specific application events:

#### Page Views
```javascript
trackPageView('Swap Page', { section: 'trading' });
```

#### Swap Transactions
```javascript
trackSwap({
  fromToken: 'ETH',
  toToken: 'USDC',
  amount: '1.5',
  slippage: '0.5'
});
```

#### Wallet Connections
```javascript
trackWalletConnect('MetaMask', userAddress);
```

#### Pool Interactions
```javascript
trackPoolInteraction({
  poolId: 'WETH-USDC',
  action: 'add_liquidity',
  amount: '100'
});
```

#### Predictions
```javascript
trackPrediction({
  asset: 'SPY',
  expiryDate: '2024-02-15',
  confidence: 75
});
```

#### Error Tracking
```javascript
trackError('Swap failed due to insufficient balance', 'INSUFFICIENT_BALANCE');
```

## Viewing Analytics Data

### On Vercel Dashboard

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click the **Analytics** tab
4. View real-time metrics:
   - Page views and visitor counts
   - Core Web Vitals (LCP, FID, CLS)
   - Custom events you've tracked
   - Geographic distribution
   - Device and browser breakdown

### Filtering and Exploration

Use the dashboard's filtering options to:
- Filter by page, device, browser, or country
- View time-series data trends
- Analyze user behavior patterns
- Track conversion metrics

## Custom Events

To add new custom event tracking:

1. Add a tracking function to `public/js/analytics.js`:

```javascript
function trackCustomEvent(data) {
  trackEvent('custom_event_name', {
    property1: data.prop1,
    property2: data.prop2,
    // Add relevant properties
  });
}
```

2. Call the function when the event occurs:

```javascript
// In your application code
document.getElementById('myButton').addEventListener('click', () => {
  trackCustomEvent({ prop1: 'value1', prop2: 'value2' });
});
```

## Privacy and Compliance

Vercel Web Analytics is designed with privacy in mind:

- **No cookies** - Uses cookieless tracking
- **GDPR compliant** - Automatically privacy-aware
- **CCPA compliant** - Respects user privacy preferences
- **IP masking** - Automatically masks visitor IP addresses
- **No personal data collection** - Only tracks behavior patterns

For more information, see [Vercel Privacy Policy Documentation](https://vercel.com/docs/analytics/privacy-policy).

## Deployment

### Prerequisites for Analytics to Work

1. **Enable Web Analytics on Vercel Dashboard**:
   - Go to your project settings
   - Navigate to Analytics tab
   - Click "Enable"

2. **Deploy to Vercel**:
   ```bash
   vercel deploy
   # or via git push if connected
   ```

3. **Wait for data collection**:
   - Initial deployment: Analytics routes are added (`/_vercel/insights/*`)
   - First metrics: Should appear within minutes of first visit
   - Historical data: Available for up to 90 days

### Expected Network Requests

After deployment, you should see requests to:
- `/_vercel/insights/script.js` - Analytics script
- `/_vercel/insights/view` - Tracking events

Check your browser's Network tab to verify these requests are succeeding.

## Development vs Production

### Development
- Analytics script loads but may not collect data
- For local testing with analytics, you need:
  1. Deploy to Vercel
  2. Visit the deployed URL
  3. Check Network tab for analytics requests

### Production
- All analytics are tracked and visible in dashboard
- Data is processed in real-time
- Historical data is retained for analysis

## Troubleshooting

### Analytics not showing data
1. Verify `/_vercel/insights/script.js` loads successfully (Network tab)
2. Check that Web Analytics is enabled on Vercel Dashboard
3. Ensure you've deployed to Vercel (not just running locally)
4. Wait a few minutes for initial data to appear

### Custom events not tracking
1. Verify `window.va` is available in console
2. Check that analytics.js loads successfully
3. Ensure events are triggered (add console.log to verify)
4. Check Vercel dashboard for "Custom Events" section

### Performance impact
- Vercel Web Analytics adds minimal overhead (~30KB gzipped)
- Scripts load with `defer` to not block page rendering
- Tracking requests use sendBeacon for minimal impact

## Testing Analytics Locally

To test analytics functionality locally:

1. **Verify window.va is available**:
   ```javascript
   // In browser console
   console.log(window.va); // Should be a function
   ```

2. **Trigger custom events**:
   ```javascript
   // In browser console
   trackEvent('test_event', { test: true });
   ```

3. **Check Network requests** (when deployed to Vercel):
   - Open DevTools Network tab
   - Look for requests to `/_vercel/insights/`
   - Should see POST requests to `/_vercel/insights/view`

## Next Steps

1. **Monitor User Behavior**: Use the dashboard to understand how users interact with the platform
2. **Optimize Performance**: Use Core Web Vitals data to improve page load times
3. **Track Conversions**: Add tracking for key user actions (swaps, deposits, etc.)
4. **A/B Testing**: Use analytics to measure impact of feature changes
5. **Set Alerts**: Monitor critical metrics and set up notifications for anomalies

## Useful Resources

- [Vercel Web Analytics Documentation](https://vercel.com/docs/analytics)
- [@vercel/analytics Package](https://www.npmjs.com/package/@vercel/analytics)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Privacy & Compliance Documentation](https://vercel.com/docs/analytics/privacy-policy)
- [Analytics Troubleshooting Guide](https://vercel.com/docs/analytics/troubleshooting)
