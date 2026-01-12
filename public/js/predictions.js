// ================================================
// Predictions Page - Main Application
// ================================================

// Use config if available, fallback to local
const API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE) ? CONFIG.API_BASE : '/api';

// Asset definitions
const ASSETS = {
    'SPY': { name: 'S&P 500 ETF', type: 'stock' },
    'QQQ': { name: 'Nasdaq 100 ETF', type: 'stock' },
    'AAPL': { name: 'Apple Inc.', type: 'stock' },
    'TSLA': { name: 'Tesla Inc.', type: 'stock' },
    'MSFT': { name: 'Microsoft', type: 'stock' },
    'GOOGL': { name: 'Alphabet', type: 'stock' },
    'AMZN': { name: 'Amazon', type: 'stock' },
    'NVDA': { name: 'NVIDIA', type: 'stock' },
    'META': { name: 'Meta Platforms', type: 'stock' },
    'BTC-USD': { name: 'Bitcoin', type: 'crypto' },
    'ETH-USD': { name: 'Ethereum', type: 'crypto' },
    'SOL-USD': { name: 'Solana', type: 'crypto' },
    'GC=F': { name: 'Gold', type: 'commodity' },
    'CL=F': { name: 'Crude Oil', type: 'commodity' }
};

// Prediction window configurations
const WINDOWS = {
    '1D': { days: 1, historicalDays: 30, interval: '15m', label: '1 Day' },
    '1W': { days: 7, historicalDays: 90, interval: '1h', label: '1 Week' },
    '1M': { days: 30, historicalDays: 180, interval: '1d', label: '1 Month' },
    '1Y': { days: 365, historicalDays: 730, interval: '1d', label: '1 Year' },
    '3Y': { days: 1095, historicalDays: 1825, interval: '1wk', label: '3 Years' },
    '5Y': { days: 1825, historicalDays: 2555, interval: '1wk', label: '5 Years' },
    '10Y': { days: 3650, historicalDays: 4380, interval: '1mo', label: '10 Years' }
};

// Application State
const state = {
    selectedAsset: 'SPY',
    selectedWindow: '1W',
    chartType: 'line',  // Default to line chart
    stakeAmount: 100,
    chartData: [],
    lastPrice: 0,
    priceChange: 0,
    chart: null,
    series: null,
    isDrawing: false,
    drawingPath: [],
    drawingHistory: [],
    predictedPrice: null,
    predictionLocked: false,
    lastDrawnX: 0,
    connected: false,
    address: null,
    predictions: [],
    // Chart Y-axis range (synced with TradingView)
    visiblePriceRange: { min: 0, max: 0 },
    // Expiry date (calculated from scroll position)
    expiryDate: null
};

// DOM Elements
const elements = {
    assetSelector: document.getElementById('assetSelector'),
    assetDropdownMenu: document.getElementById('assetDropdownMenu'),
    assetSymbol: document.getElementById('assetSymbol'),
    assetName: document.getElementById('assetName'),
    assetPrice: document.getElementById('assetPrice'),
    assetChange: document.getElementById('assetChange'),
    chartArea: document.getElementById('chartArea'),
    chartLoading: document.getElementById('chartLoading'),
    predictionCanvas: document.getElementById('predictionCanvas'),
    predictionOverlay: document.getElementById('predictionOverlay'),
    currentPrice: document.getElementById('currentPrice'),
    predictedPrice: document.getElementById('predictedPrice'),
    predictedChange: document.getElementById('predictedChange'),
    predictionEnds: document.getElementById('predictionEnds'),
    potentialPayoff: document.getElementById('potentialPayoff'),
    payoffMultiplier: document.getElementById('payoffMultiplier'),
    stakeDisplay: document.getElementById('stakeDisplay'),
    maxWin: document.getElementById('maxWin'),
    submitPredictionBtn: document.getElementById('submitPredictionBtn'),
    predictionsList: document.getElementById('predictionsList'),
    connectWalletBtn: document.getElementById('connectWalletBtn'),
    drawBtn: document.getElementById('drawBtn'),
    clearBtn: document.getElementById('clearBtn'),
    undoBtn: document.getElementById('undoBtn'),
    timelineScrollContainer: document.getElementById('timelineScrollContainer'),
    timelineContent: document.getElementById('timelineContent'),
    nowDivider: document.getElementById('nowDivider'),
    unifiedXAxis: document.getElementById('unifiedXAxis'),
    predictionArea: document.getElementById('predictionArea'),
    expiryDisplay: document.getElementById('expiryDisplay'),
    expiryDate: document.getElementById('expiryDate')
};

// Canvas context
let ctx = null;
let canvasRect = null;
let priceRange = { min: 0, max: 0 };

// ================================================
// Initialization
// ================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});

async function initializeApp() {
    setupCanvas();
    setupEventListeners();
    setupWeb3EventListeners();
    await loadChartData();
    loadPredictions();
    updatePayoffDisplay();

    // Scroll to show "Now" divider in view
    scrollToNow();

    // Check if already connected (page refresh)
    if (Web3Integration.isWeb3Available() && window.ethereum.selectedAddress) {
        try {
            await connectWallet();
        } catch (e) {
            console.log('Auto-connect failed:', e);
        }
    }
}

// ================================================
// Event Listeners
// ================================================

function setupEventListeners() {
    // Asset dropdown
    elements.assetSelector?.addEventListener('click', toggleAssetDropdown);
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const value = e.target.dataset.value;
            if (value) handleAssetSelect(value);
        });
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.assetSelector?.contains(e.target) && !elements.assetDropdownMenu?.contains(e.target)) {
            closeAssetDropdown();
        }
    });

    // Drawing tools
    elements.drawBtn?.addEventListener('click', () => setActiveTool('draw'));
    elements.clearBtn?.addEventListener('click', clearDrawing);
    elements.undoBtn?.addEventListener('click', undoDrawing);

    // Canvas events
    setupCanvasEvents();

    // Submit button
    elements.submitPredictionBtn?.addEventListener('click', submitPrediction);

    // Wallet connection - use new auth modal
    elements.connectWalletBtn?.addEventListener('click', () => window.InsiderAuth?.openAuthModal());

    // Window resize
    window.addEventListener('resize', debounce(handleResize, 250));

    // Timeline scroll - update expiry date
    elements.timelineScrollContainer?.addEventListener('scroll', debounce(updateExpiryFromScroll, 50));
}

function toggleAssetDropdown() {
    elements.assetSelector?.classList.toggle('open');
    elements.assetDropdownMenu?.classList.toggle('show');
}

function closeAssetDropdown() {
    elements.assetSelector?.classList.remove('open');
    elements.assetDropdownMenu?.classList.remove('show');
}

function handleAssetSelect(assetValue) {
    state.selectedAsset = assetValue;
    const asset = ASSETS[assetValue];

    // Update display
    if (elements.assetSymbol) elements.assetSymbol.textContent = assetValue;
    if (elements.assetName) elements.assetName.textContent = asset?.name || assetValue;

    // Close dropdown
    closeAssetDropdown();

    // Reload chart data
    clearDrawing();
    loadChartData();
}

function scrollToNow() {
    const container = elements.timelineScrollContainer;
    const nowDivider = elements.nowDivider;

    if (container && nowDivider) {
        // Calculate scroll position to center the "Now" divider
        const containerWidth = container.clientWidth;
        const dividerOffset = nowDivider.offsetLeft;

        // Scroll so "Now" is visible with some chart history showing
        const scrollTarget = dividerOffset - (containerWidth * 0.4);
        container.scrollLeft = Math.max(0, scrollTarget);
    }

    // Initial expiry calculation
    updateExpiryFromScroll();
}

function updateExpiryFromScroll() {
    const container = elements.timelineScrollContainer;
    const predictionArea = elements.predictionArea;
    const nowDivider = elements.nowDivider;

    if (!container || !predictionArea || !nowDivider) return;

    const config = WINDOWS[state.selectedWindow];

    // Calculate where the right edge of visible area falls in the prediction area
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    const visibleRightEdge = scrollLeft + containerWidth;

    // Get the position where the prediction area starts (after now divider)
    const predictionAreaStart = nowDivider.offsetLeft + nowDivider.offsetWidth;
    const predictionAreaWidth = predictionArea.offsetWidth;

    // Calculate how far into the prediction area the right edge is
    const distanceIntoPrediction = visibleRightEdge - predictionAreaStart;

    // Calculate the ratio (0 = start of prediction area, 1 = end)
    const ratio = Math.max(0, Math.min(1, distanceIntoPrediction / predictionAreaWidth));

    // Calculate the expiry date based on the ratio and prediction window
    const now = new Date();
    const daysIntoFuture = ratio * config.days;
    const expiryDate = new Date(now.getTime() + (daysIntoFuture * 24 * 60 * 60 * 1000));

    // Store expiry date in state
    state.expiryDate = expiryDate;

    // Update the display
    updateExpiryDisplay(expiryDate);

    // Also update the "Prediction Ends" field
    if (elements.predictionEnds) {
        elements.predictionEnds.textContent = formatExpiryDate(expiryDate);
    }
}

function updateExpiryDisplay(date) {
    if (!elements.expiryDate) return;

    const formattedDate = formatExpiryDate(date);
    elements.expiryDate.textContent = formattedDate;

    // Add visual feedback
    elements.expiryDisplay?.classList.add('updated');
    setTimeout(() => {
        elements.expiryDisplay?.classList.remove('updated');
    }, 200);
}

function formatExpiryDate(date) {
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    // Format date
    const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    // Add relative time
    let relativeStr;
    if (diffDays === 0) {
        relativeStr = 'Today';
    } else if (diffDays === 1) {
        relativeStr = 'Tomorrow';
    } else if (diffDays < 7) {
        relativeStr = `${diffDays} days`;
    } else if (diffDays < 30) {
        const weeks = Math.round(diffDays / 7);
        relativeStr = `${weeks} week${weeks > 1 ? 's' : ''}`;
    } else if (diffDays < 365) {
        const months = Math.round(diffDays / 30);
        relativeStr = `${months} month${months > 1 ? 's' : ''}`;
    } else {
        const years = Math.round(diffDays / 365);
        relativeStr = `${years} year${years > 1 ? 's' : ''}`;
    }

    return `${dateStr} (${relativeStr})`;
}

function setupCanvasEvents() {
    const canvas = elements.predictionCanvas;
    if (!canvas) return;

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
}

// ================================================
// Chart Functions
// ================================================

async function loadChartData() {
    showLoading(true);

    try {
        const data = await fetchPriceData(state.selectedAsset, state.selectedWindow);
        state.chartData = data.candles;
        state.lastPrice = data.lastPrice;
        state.priceChange = data.priceChange;

        updateAssetInfo();
        renderChart();
        setupPredictionCanvas();
    } catch (error) {
        console.error('Failed to load chart data:', error);
        // Use mock data as fallback
        generateMockData();
        updateAssetInfo();
        renderChart();
        setupPredictionCanvas();
    }

    showLoading(false);
}

async function fetchPriceData(symbol, window) {
    try {
        const response = await fetch(`${API_BASE}/prices/${symbol}?window=${window}`);
        const data = await response.json();

        if (data.success) {
            return data.data;
        }
        throw new Error(data.error);
    } catch (error) {
        console.error('API Error:', error);
        // Return mock data
        return generateMockData();
    }
}

function generateMockData() {
    const config = WINDOWS[state.selectedWindow];
    const numCandles = Math.min(config.historicalDays, 200);
    const candles = [];

    // Base prices for different assets
    const basePrices = {
        'SPY': 450, 'QQQ': 380, 'AAPL': 175, 'TSLA': 250,
        'MSFT': 380, 'GOOGL': 140, 'AMZN': 175, 'NVDA': 480,
        'META': 350, 'BTC-USD': 43000, 'ETH-USD': 2400,
        'SOL-USD': 100, 'GC=F': 2000, 'CL=F': 75
    };

    let price = basePrices[state.selectedAsset] || 100;
    const volatility = state.selectedAsset.includes('BTC') || state.selectedAsset.includes('ETH') ? 0.03 : 0.015;

    const now = new Date();
    const msPerCandle = (config.historicalDays * 24 * 60 * 60 * 1000) / numCandles;

    for (let i = numCandles - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - (i * msPerCandle));
        const change = (Math.random() - 0.48) * volatility;
        const open = price;
        price = price * (1 + change);
        const close = price;
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

        candles.push({
            time: Math.floor(time.getTime() / 1000),
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2))
        });
    }

    state.chartData = candles;
    state.lastPrice = candles[candles.length - 1].close;

    // Calculate price change
    const firstPrice = candles[0].open;
    state.priceChange = ((state.lastPrice - firstPrice) / firstPrice) * 100;

    return {
        candles,
        lastPrice: state.lastPrice,
        priceChange: state.priceChange
    };
}

function renderChart() {
    const chartArea = elements.chartArea;
    if (!chartArea || typeof LightweightCharts === 'undefined') return;

    // Clear existing chart
    if (state.chart) {
        state.chart.remove();
    }

    // Create chart
    state.chart = LightweightCharts.createChart(chartArea, {
        width: chartArea.clientWidth,
        height: chartArea.clientHeight,
        layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: '#9CA3AF'
        },
        grid: {
            vertLines: { color: 'rgba(42, 43, 53, 0.5)' },
            horzLines: { color: 'rgba(42, 43, 53, 0.5)' }
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                color: '#00D4AA',
                width: 1,
                style: 2
            },
            horzLine: {
                color: '#00D4AA',
                width: 1,
                style: 2
            }
        },
        rightPriceScale: {
            borderColor: '#2A2B35',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1
            }
        },
        timeScale: {
            borderColor: '#2A2B35',
            timeVisible: true,
            secondsVisible: false
        },
        handleScroll: {
            vertTouchDrag: false
        }
    });

    // Add series based on chart type
    if (state.chartType === 'candlestick') {
        state.series = state.chart.addCandlestickSeries({
            upColor: '#10B981',
            downColor: '#EF4444',
            borderDownColor: '#EF4444',
            borderUpColor: '#10B981',
            wickDownColor: '#EF4444',
            wickUpColor: '#10B981'
        });
    } else {
        state.series = state.chart.addLineSeries({
            color: '#00D4AA',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 4
        });
    }

    // Set data
    if (state.chartType === 'candlestick') {
        state.series.setData(state.chartData);
    } else {
        const lineData = state.chartData.map(d => ({
            time: d.time,
            value: d.close
        }));
        state.series.setData(lineData);
    }

    // Calculate price range for canvas based on target price if set
    updateCanvasPriceRange();

    // Fit content
    state.chart.timeScale().fitContent();

    // Subscribe to visible range changes to sync canvas price range
    const debouncedSync = debounce(syncPriceRangeWithChart, 100);

    state.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        debouncedSync();
    });

    // Subscribe to crosshair move to detect Y-axis scaling/dragging
    state.chart.subscribeCrosshairMove((param) => {
        // Sync when interacting with chart to capture Y-axis changes
        if (param.point) {
            debouncedSync();
        }
    });

    // Also listen for mouse up on chart area to catch end of Y-axis drag
    elements.chartArea?.addEventListener('mouseup', () => {
        // Small delay to ensure chart has updated
        setTimeout(syncPriceRangeWithChart, 50);
    });
}

function updateCanvasPriceRange() {
    // Use historical price range with extended padding for drawing flexibility
    const prices = state.chartData.flatMap(d => [d.high, d.low]);
    if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const range = maxPrice - minPrice;
        // 30% padding above and below for drawing predictions
        priceRange.min = minPrice - (range * 0.3);
        priceRange.max = maxPrice + (range * 0.3);
        state.visiblePriceRange = { min: priceRange.min, max: priceRange.max };
    }
}

function updateAssetInfo() {
    const asset = ASSETS[state.selectedAsset];

    if (elements.assetSymbol) {
        elements.assetSymbol.textContent = state.selectedAsset.replace('-USD', '');
    }
    if (elements.assetName) {
        elements.assetName.textContent = asset?.name || state.selectedAsset;
    }
    if (elements.assetPrice) {
        elements.assetPrice.textContent = formatCurrency(state.lastPrice);
    }
    if (elements.assetChange) {
        const changeStr = `${state.priceChange >= 0 ? '+' : ''}${state.priceChange.toFixed(2)}%`;
        elements.assetChange.textContent = changeStr;
        elements.assetChange.className = `asset-change ${state.priceChange >= 0 ? 'positive' : 'negative'}`;
    }
    if (elements.currentPrice) {
        elements.currentPrice.textContent = formatCurrency(state.lastPrice);
    }

    // Update prediction end date
    updatePredictionEndDate();
}

// ================================================
// Canvas Drawing Functions
// ================================================

function setupCanvas() {
    const canvas = elements.predictionCanvas;
    if (!canvas) return;

    // Set canvas size
    resizeCanvas();

    // Get context
    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function resizeCanvas() {
    const canvas = elements.predictionCanvas;
    const container = canvas.parentElement;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    canvasRect = canvas.getBoundingClientRect();

    // Redraw existing path
    if (state.drawingPath.length > 0) {
        redrawCanvas();
    }
}

function setupPredictionCanvas() {
    resizeCanvas();

    // Draw grid
    drawGrid();

    // Update the price range from chart's visible range
    syncPriceRangeWithChart();

    // Render unified x-axis
    renderUnifiedXAxis();
}

function syncPriceRangeWithChart() {
    // Get visible price range from TradingView chart
    if (state.chart && state.series) {
        try {
            const chartArea = elements.chartArea;
            const chartHeight = chartArea.clientHeight;

            // Get the actual visible price range by converting coordinates
            // Top of chart (y=0) corresponds to max visible price
            // Bottom of chart (y=height) corresponds to min visible price
            const topPrice = state.series.coordinateToPrice(0);
            const bottomPrice = state.series.coordinateToPrice(chartHeight);

            if (topPrice !== null && bottomPrice !== null && !isNaN(topPrice) && !isNaN(bottomPrice)) {
                // Use the actual visible range from the chart
                priceRange.min = Math.min(topPrice, bottomPrice);
                priceRange.max = Math.max(topPrice, bottomPrice);
                state.visiblePriceRange = { min: priceRange.min, max: priceRange.max };
            } else {
                // Fallback: Calculate from data with margins
                const prices = state.chartData.flatMap(d =>
                    state.chartType === 'candlestick' ? [d.high, d.low] : [d.close || d.value]
                );

                if (prices.length > 0) {
                    const minPrice = Math.min(...prices);
                    const maxPrice = Math.max(...prices);
                    const dataRange = maxPrice - minPrice;
                    const visibleRange = dataRange / 0.8;
                    const margin = visibleRange * 0.1;

                    priceRange.min = minPrice - margin;
                    priceRange.max = maxPrice + margin;
                    state.visiblePriceRange = { min: priceRange.min, max: priceRange.max };
                }
            }
        } catch (e) {
            console.error('Error syncing price range:', e);
            // Fallback to chart data range with padding
            const prices = state.chartData.flatMap(d => [d.high || d.close, d.low || d.close]);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const padding = (maxPrice - minPrice) * 0.25;
            priceRange.min = minPrice - padding;
            priceRange.max = maxPrice + padding;
        }
    }

    // Redraw canvas with updated price range
    redrawCanvas();
}

function renderUnifiedXAxis() {
    const container = elements.unifiedXAxis;
    if (!container) return;

    const config = WINDOWS[state.selectedWindow];
    const totalDays = config.historicalDays + config.days;

    // Generate labels for the entire timeline
    const numLabels = 7;
    const labels = [];

    for (let i = 0; i < numLabels; i++) {
        const position = i / (numLabels - 1); // 0 to 1
        const daysFromStart = position * totalDays;
        const daysFromNow = daysFromStart - config.historicalDays;

        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);

        let label;
        let isFuture = daysFromNow > 0;
        let isNear = Math.abs(daysFromNow) < 1;

        if (isNear) {
            label = 'Today';
        } else if (totalDays <= 30) {
            label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (totalDays <= 365) {
            label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        } else {
            label = date.getFullYear().toString();
        }

        labels.push({ label, position: position * 100, isFuture, isNear });
    }

    container.innerHTML = labels.map((item, index) => {
        const classes = ['x-axis-label'];
        if (item.isFuture) classes.push('future');
        if (item.isNear) classes.push('divider-label');

        return `<span class="${classes.join(' ')}" style="left: ${item.position}%">${item.label}</span>`;
    }).join('');
}

function drawGrid() {
    if (!ctx) return;

    const canvas = elements.predictionCanvas;
    const width = canvas.width;
    const height = canvas.height;

    ctx.strokeStyle = 'rgba(42, 43, 53, 0.5)';
    ctx.lineWidth = 1;

    // Horizontal lines
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Vertical lines
    for (let i = 0; i <= 4; i++) {
        const x = (width / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Draw starting price line (current price level)
    const startY = priceToY(state.lastPrice);

    // Draw a more prominent starting price indicator
    // Dashed line across canvas
    ctx.strokeStyle = 'rgba(0, 212, 170, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.lineTo(width, startY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw solid line segment at the start
    ctx.strokeStyle = '#00D4AA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.lineTo(30, startY);
    ctx.stroke();

    // Draw starting point circle
    ctx.fillStyle = '#00D4AA';
    ctx.beginPath();
    ctx.arc(0, startY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw inner circle
    ctx.fillStyle = '#0A0B0D';
    ctx.beginPath();
    ctx.arc(0, startY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw price label on the right side
    const priceLabel = formatPrice(state.lastPrice);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#00D4AA';
    ctx.textAlign = 'right';
    ctx.fillText(priceLabel, width - 8, startY + 4);
}

function startDrawing(e) {
    if (state.activeTool === 'erase') return;

    // Don't allow drawing if prediction is locked
    if (state.predictionLocked) return;

    state.isDrawing = true;

    // Hide overlay
    elements.predictionOverlay?.classList.add('hidden');

    const pos = getCanvasPosition(e);

    // Save state for undo
    state.drawingHistory.push([...state.drawingPath]);

    // Start new path or continue from last point
    if (state.drawingPath.length === 0) {
        // Start from current price level on left edge
        const startY = priceToY(state.lastPrice);
        state.drawingPath.push({ x: 0, y: startY });
        state.lastDrawnX = 0;
    }

    // Only add point if it's forward from last drawn position
    if (pos.x > state.lastDrawnX) {
        state.drawingPath.push(pos);
        state.lastDrawnX = pos.x;
        redrawCanvas();
        checkPredictionComplete();
    }
}

function draw(e) {
    if (!state.isDrawing) return;
    if (state.predictionLocked) return;

    const pos = getCanvasPosition(e);

    // Only allow drawing forward (to the right) - ignore any leftward movement
    if (pos.x > state.lastDrawnX) {
        state.drawingPath.push(pos);
        state.lastDrawnX = pos.x;
        redrawCanvas();
        updatePredictedPrice();
        checkPredictionComplete();
    }
    // If user tries to move left, simply ignore it
}

function stopDrawing() {
    if (state.isDrawing) {
        state.isDrawing = false;
        updatePredictedPrice();
        updateSubmitButton();
    }
}

function checkPredictionComplete() {
    const canvas = elements.predictionCanvas;
    if (!canvas) return;

    // Lock prediction when drawing reaches near the right edge (within 10px)
    const rightEdgeThreshold = canvas.width - 10;

    if (state.lastDrawnX >= rightEdgeThreshold && !state.predictionLocked) {
        state.predictionLocked = true;
        state.isDrawing = false;

        // Update canvas cursor to show it's locked
        canvas.style.cursor = 'not-allowed';

        // Draw the lock indicator
        redrawCanvas();
        updatePredictedPrice();
        updateSubmitButton();

        // Show a brief notification
        showLockNotification();
    }
}

function showLockNotification() {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('predictionLockedNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'predictionLockedNotification';
        notification.className = 'prediction-locked-notification';
        notification.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/>
                <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span>Prediction locked! Ready to submit.</span>
        `;
        document.body.appendChild(notification);
    }

    // Show notification
    notification.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    startDrawing(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    draw(mouseEvent);
}

function getCanvasPosition(e) {
    const canvas = elements.predictionCanvas;
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function redrawCanvas() {
    if (!ctx) return;

    const canvas = elements.predictionCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw grid
    drawGrid();

    // Draw path
    if (state.drawingPath.length > 1) {
        ctx.strokeStyle = '#00D4AA';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(state.drawingPath[0].x, state.drawingPath[0].y);

        for (let i = 1; i < state.drawingPath.length; i++) {
            ctx.lineTo(state.drawingPath[i].x, state.drawingPath[i].y);
        }

        ctx.stroke();

        // Draw endpoint
        const lastPoint = state.drawingPath[state.drawingPath.length - 1];
        ctx.fillStyle = '#00D4AA';
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 6, 0, Math.PI * 2);
        ctx.fill();

        // Draw price label at endpoint
        const predictedPrice = yToPrice(lastPoint.y);
        ctx.fillStyle = '#00D4AA';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(formatCurrency(predictedPrice), lastPoint.x + 12, lastPoint.y + 4);
    }
}

function clearDrawing() {
    state.drawingHistory.push([...state.drawingPath]);
    state.drawingPath = [];
    state.predictedPrice = null;
    state.predictionLocked = false;
    state.lastDrawnX = 0;

    // Reset canvas cursor
    const canvas = elements.predictionCanvas;
    if (canvas) {
        canvas.style.cursor = 'crosshair';
    }

    redrawCanvas();
    updatePredictedPrice();
    updateSubmitButton();

    elements.predictionOverlay?.classList.remove('hidden');
}

function undoDrawing() {
    if (state.drawingHistory.length > 0) {
        state.drawingPath = state.drawingHistory.pop();

        // Reset locked state and recalculate lastDrawnX
        state.predictionLocked = false;
        state.lastDrawnX = state.drawingPath.length > 0
            ? state.drawingPath[state.drawingPath.length - 1].x
            : 0;

        // Reset canvas cursor
        const canvas = elements.predictionCanvas;
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }

        redrawCanvas();
        updatePredictedPrice();
        updateSubmitButton();

        if (state.drawingPath.length === 0) {
            elements.predictionOverlay?.classList.remove('hidden');
        }
    }
}

function setActiveTool(tool) {
    state.activeTool = tool;

    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (tool === 'draw') {
        elements.drawBtn?.classList.add('active');
    } else if (tool === 'erase') {
        elements.eraseBtn?.classList.add('active');
    }
}

// ================================================
// Price Conversion Functions
// ================================================

function priceToY(price) {
    const canvas = elements.predictionCanvas;
    const range = priceRange.max - priceRange.min;
    const ratio = (priceRange.max - price) / range;
    return ratio * canvas.height;
}

function yToPrice(y) {
    const canvas = elements.predictionCanvas;
    const range = priceRange.max - priceRange.min;
    const ratio = y / canvas.height;
    return priceRange.max - (ratio * range);
}

// ================================================
// Prediction Functions
// ================================================

function updatePredictedPrice() {
    if (state.drawingPath.length < 2) {
        state.predictedPrice = null;
        if (elements.predictedPrice) elements.predictedPrice.textContent = 'Draw to predict';
        if (elements.predictedChange) elements.predictedChange.textContent = '-';
        return;
    }

    const lastPoint = state.drawingPath[state.drawingPath.length - 1];
    state.predictedPrice = yToPrice(lastPoint.y);

    const changePercent = ((state.predictedPrice - state.lastPrice) / state.lastPrice) * 100;

    if (elements.predictedPrice) {
        elements.predictedPrice.textContent = formatCurrency(state.predictedPrice);
    }

    if (elements.predictedChange) {
        const changeStr = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
        elements.predictedChange.textContent = changeStr;
        elements.predictedChange.className = `info-value ${changePercent >= 0 ? 'positive' : 'negative'}`;
        elements.predictedChange.style.color = changePercent >= 0 ? 'var(--color-success)' : 'var(--color-error)';
    }

    updatePayoffDisplay();
}

function updatePredictionEndDate() {
    // Use the scroll-based expiry date if available, otherwise calculate from scroll
    if (state.expiryDate) {
        if (elements.predictionEnds) {
            elements.predictionEnds.textContent = formatExpiryDate(state.expiryDate);
        }
    } else {
        // Trigger scroll-based calculation
        updateExpiryFromScroll();
    }
}

function updatePayoffDisplay() {
    const stake = state.stakeAmount;
    const maxMultiplier = 10;
    const maxWin = stake * maxMultiplier;

    if (elements.stakeDisplay) {
        elements.stakeDisplay.textContent = `${stake} USDC`;
    }

    if (elements.maxWin) {
        elements.maxWin.textContent = `${maxWin.toLocaleString()} USDC`;
    }

    if (state.predictedPrice !== null && state.drawingPath.length > 1) {
        // Show max potential payout (actual payout determined by Riemann Sum at settlement)
        const potentialWin = stake * maxMultiplier;

        if (elements.potentialPayoff) {
            elements.potentialPayoff.textContent = `Up to ${potentialWin.toLocaleString()} USDC`;
        }

        if (elements.payoffMultiplier) {
            elements.payoffMultiplier.textContent = 'Based on path accuracy';
        }
    } else {
        if (elements.potentialPayoff) {
            elements.potentialPayoff.textContent = '-';
        }
        if (elements.payoffMultiplier) {
            elements.payoffMultiplier.textContent = 'Up to 10x';
        }
    }
}

/**
 * Calculate Riemann Sum score comparing predicted path vs actual prices
 * @param {Array} predictedPath - Array of {time, price} points from drawing
 * @param {Array} actualPrices - Array of {time, price} actual market prices (5-min intervals)
 * @returns {number} Score between 0 and 1 (1 = perfect prediction)
 */
function calculateRiemannSumScore(predictedPath, actualPrices) {
    if (!predictedPath || predictedPath.length < 2 || !actualPrices || actualPrices.length < 2) {
        return 0;
    }

    const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Get time range
    const startTime = Math.min(predictedPath[0].time, actualPrices[0].time);
    const endTime = Math.max(
        predictedPath[predictedPath.length - 1].time,
        actualPrices[actualPrices.length - 1].time
    );

    // Calculate number of 5-minute ticks
    const numTicks = Math.floor((endTime - startTime) / TICK_INTERVAL_MS);
    if (numTicks < 1) return 0;

    let totalDifference = 0;
    let totalActualValue = 0;

    // Sample at each 5-minute tick
    for (let i = 0; i <= numTicks; i++) {
        const tickTime = startTime + (i * TICK_INTERVAL_MS);

        // Interpolate predicted price at this tick
        const predictedPrice = interpolatePrice(predictedPath, tickTime);

        // Interpolate actual price at this tick
        const actualPrice = interpolatePrice(actualPrices, tickTime);

        if (predictedPrice !== null && actualPrice !== null) {
            totalDifference += Math.abs(predictedPrice - actualPrice) * TICK_INTERVAL_MS;
            totalActualValue += Math.abs(actualPrice) * TICK_INTERVAL_MS;
        }
    }

    // Score = 1 - (∫|predicted - actual|dt / ∫|actual|dt)
    if (totalActualValue === 0) return 0;

    const score = Math.max(0, 1 - (totalDifference / totalActualValue));
    return score;
}

/**
 * Interpolate price at a given timestamp from a price path
 * @param {Array} pricePath - Array of {time, price} points
 * @param {number} targetTime - Timestamp to interpolate at
 * @returns {number|null} Interpolated price or null if out of range
 */
function interpolatePrice(pricePath, targetTime) {
    if (!pricePath || pricePath.length === 0) return null;

    // Handle edge cases
    if (targetTime <= pricePath[0].time) return pricePath[0].price;
    if (targetTime >= pricePath[pricePath.length - 1].time) {
        return pricePath[pricePath.length - 1].price;
    }

    // Find surrounding points
    for (let i = 0; i < pricePath.length - 1; i++) {
        const p1 = pricePath[i];
        const p2 = pricePath[i + 1];

        if (targetTime >= p1.time && targetTime <= p2.time) {
            // Linear interpolation
            const ratio = (targetTime - p1.time) / (p2.time - p1.time);
            return p1.price + (p2.price - p1.price) * ratio;
        }
    }

    return null;
}

/**
 * Convert drawing path to timestamped price path for Riemann Sum
 * @param {Array} drawingPath - Canvas coordinates from drawing
 * @returns {Array} Array of {time, price} points
 */
function drawingPathToTimestampedPrices() {
    if (!state.drawingPath || state.drawingPath.length < 2) return [];

    const canvas = elements.predictionCanvas;
    if (!canvas) return [];

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Get time range from expiry
    const now = Date.now();
    const expiryTime = state.expiryDate ? state.expiryDate.getTime() : now + (7 * 24 * 60 * 60 * 1000);
    const timeRange = expiryTime - now;

    // Get price range
    const priceMin = priceRange.min;
    const priceMax = priceRange.max;
    const priceSpan = priceMax - priceMin;

    // Convert each point
    return state.drawingPath.map(point => {
        // X position (0 to 1) maps to time (now to expiry)
        const xRatio = point.x / canvasWidth;
        const time = now + (xRatio * timeRange);

        // Y position (0 to 1, inverted) maps to price
        const yRatio = 1 - (point.y / canvasHeight);
        const price = priceMin + (yRatio * priceSpan);

        return { time, price };
    });
}

/**
 * Calculate payout multiplier from Riemann Sum score
 * @param {number} score - Score between 0 and 1
 * @returns {number} Multiplier (0 to 10)
 */
function scoreToMultiplier(score) {
    // Linear scale: score 1.0 = 10x, score 0 = 0x
    return Math.round(score * 10 * 100) / 100; // Round to 2 decimal places
}

function updateSubmitButton() {
    const canSubmit = state.drawingPath.length > 1 && state.predictedPrice !== null;

    if (elements.submitPredictionBtn) {
        elements.submitPredictionBtn.disabled = !canSubmit;

        const btnText = elements.submitPredictionBtn.querySelector('.btn-text');
        if (btnText) {
            if (!state.connected) {
                btnText.textContent = 'Connect Wallet to Submit';
            } else if (canSubmit) {
                btnText.textContent = `Submit Prediction (${state.stakeAmount} USDC)`;
            } else {
                btnText.textContent = 'Draw Your Prediction First';
            }
        }
    }
}

async function submitPrediction() {
    if (!state.connected) {
        window.InsiderAuth?.openAuthModal();
        return;
    }

    if (!state.predictedPrice) {
        showNotification('Please draw your prediction first', 'warning');
        return;
    }

    // Check if on correct network
    if (!Web3Integration.isOnCorrectNetwork()) {
        showNotification('Please switch to Sepolia testnet', 'warning');
        try {
            await Web3Integration.switchNetwork('sepolia');
        } catch (error) {
            console.error('Failed to switch network:', error);
        }
        return;
    }

    // Check if contract is available
    const hasContract = Web3Integration.state.contract !== null;

    // Convert drawing path to timestamped prices for Riemann Sum scoring
    const timestampedPath = drawingPathToTimestampedPrices();

    // Create prediction object
    const prediction = {
        id: Date.now().toString(),
        asset: state.selectedAsset,
        assetName: ASSETS[state.selectedAsset]?.name || state.selectedAsset,
        window: state.selectedWindow,
        windowLabel: WINDOWS[state.selectedWindow].label,
        startPrice: state.lastPrice,
        predictedPrice: state.predictedPrice,
        stake: state.stakeAmount,
        createdAt: new Date().toISOString(),
        endsAt: getEndDate().toISOString(),
        status: 'pending',
        drawingPath: [...state.drawingPath],
        // Timestamped path for Riemann Sum scoring (5-min tick data)
        timestampedPath: timestampedPath,
        scoringMethod: 'riemann_sum'
    };

    // Show transaction modal
    showTransactionModal('pending', 'Submitting Prediction', 'Please confirm the transaction in your wallet...');

    try {
        if (hasContract) {
            // Submit to blockchain
            const stakeInEth = (state.stakeAmount / 1000).toFixed(4); // Convert USDC value to ETH (simplified)
            const result = await Web3Integration.createOnChainPrediction(
                state.selectedAsset,
                state.lastPrice,
                state.predictedPrice,
                getEndDate(),
                stakeInEth
            );

            prediction.onChainId = result.predictionId;
            prediction.transactionHash = result.transactionHash;
            prediction.isOnChain = true;

            // Update modal with success
            showTransactionModal('success', 'Prediction Submitted!',
                'Your prediction has been recorded on the blockchain.',
                result.transactionHash
            );
        } else {
            // No contract deployed - save locally only
            await savePrediction(prediction);
            showTransactionModal('success', 'Prediction Saved',
                'Contract not deployed yet. Prediction saved locally for testing.'
            );
        }

        // Add to local state
        state.predictions.unshift(prediction);

        // Update UI
        renderPredictionsList();
        clearDrawing();

    } catch (error) {
        console.error('Failed to submit prediction:', error);
        showTransactionModal('error', 'Transaction Failed', error.message || 'Failed to submit prediction');
    }
}

function showTransactionModal(status, title, message, txHash = null) {
    // Remove existing modal
    let modal = document.getElementById('txModalOverlay');
    if (modal) modal.remove();

    // Create modal HTML
    const iconSvg = status === 'pending'
        ? '<svg class="tx-modal-icon loading" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M12 2C6.5 2 2 6.5 2 12" stroke="var(--color-accent-primary)" stroke-width="2" stroke-linecap="round"/></svg>'
        : status === 'success'
            ? '<svg class="tx-modal-icon success" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '<svg class="tx-modal-icon error" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9L9 15M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    const explorerLink = txHash && Web3Integration.getExplorerUrl(txHash)
        ? `<a href="${Web3Integration.getExplorerUrl(txHash)}" target="_blank" class="tx-modal-link">
            View on Etherscan
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 13V19C18 20.1 17.1 21 16 21H5C3.9 21 3 20.1 3 19V8C3 6.9 3.9 6 5 6H11" stroke="currentColor" stroke-width="2"/><path d="M15 3H21V9" stroke="currentColor" stroke-width="2"/><path d="M10 14L21 3" stroke="currentColor" stroke-width="2"/></svg>
           </a>`
        : '';

    const closeBtn = status !== 'pending'
        ? `<button class="tx-modal-btn" onclick="document.getElementById('txModalOverlay').classList.remove('show')">Close</button>`
        : '';

    modal = document.createElement('div');
    modal.id = 'txModalOverlay';
    modal.className = 'tx-modal-overlay show';
    modal.innerHTML = `
        <div class="tx-modal">
            ${iconSvg}
            <h3 class="tx-modal-title">${title}</h3>
            <p class="tx-modal-message">${message}</p>
            ${explorerLink}
            ${closeBtn}
        </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click (not for pending)
    if (status !== 'pending') {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }
}

async function savePrediction(prediction) {
    try {
        const response = await fetch(`${API_BASE}/predictions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prediction)
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        return data.data;
    } catch (error) {
        // For demo, just store locally
        const predictions = JSON.parse(localStorage.getItem('predictions') || '[]');
        predictions.unshift(prediction);
        localStorage.setItem('predictions', JSON.stringify(predictions));
        return prediction;
    }
}

function loadPredictions() {
    try {
        state.predictions = JSON.parse(localStorage.getItem('predictions') || '[]');
        renderPredictionsList();
    } catch (error) {
        console.error('Failed to load predictions:', error);
    }
}

function renderPredictionsList() {
    if (!elements.predictionsList) return;

    if (state.predictions.length === 0) {
        elements.predictionsList.innerHTML = `
            <div class="empty-predictions">
                <svg viewBox="0 0 24 24" fill="none" class="empty-icon">
                    <path d="M3 3V21H21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M7 14L11 10L15 14L21 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>No active predictions</p>
                <span>Make your first prediction above!</span>
            </div>
        `;
        return;
    }

    elements.predictionsList.innerHTML = state.predictions.map(pred => {
        const changePercent = ((pred.predictedPrice - pred.startPrice) / pred.startPrice) * 100;
        const isUp = changePercent >= 0;
        const endDate = new Date(pred.endsAt);
        const timeLeft = getTimeLeft(endDate);

        return `
            <div class="prediction-item">
                <div class="prediction-asset">
                    <div class="prediction-asset-icon">${pred.asset.replace('-USD', '').slice(0, 3)}</div>
                    <div class="prediction-asset-info">
                        <span class="prediction-asset-symbol">${pred.asset.replace('-USD', '')}</span>
                        <span class="prediction-asset-window">${pred.windowLabel}</span>
                    </div>
                </div>
                <div class="prediction-prices">
                    <div class="prediction-price-item">
                        <span class="prediction-price-label">Start</span>
                        <span class="prediction-price-value">${formatCurrency(pred.startPrice)}</span>
                    </div>
                    <div class="prediction-price-item">
                        <span class="prediction-price-label">Predicted</span>
                        <span class="prediction-price-value ${isUp ? 'up' : 'down'}">${formatCurrency(pred.predictedPrice)}</span>
                    </div>
                    <div class="prediction-price-item">
                        <span class="prediction-price-label">Change</span>
                        <span class="prediction-price-value ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${changePercent.toFixed(2)}%</span>
                    </div>
                </div>
                <div class="prediction-status">
                    <span class="status-badge ${pred.status}">${pred.status}</span>
                    <span class="prediction-time-left">${timeLeft}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ================================================
// Event Handlers
// ================================================

function handleResize() {
    if (state.chart) {
        const chartArea = elements.chartArea;
        state.chart.resize(chartArea.clientWidth, chartArea.clientHeight);
    }
    resizeCanvas();
}

// ================================================
// Wallet Connection
// ================================================

async function connectWallet() {
    // Check if Web3 is available
    if (!Web3Integration.isWeb3Available()) {
        showNotification('Please install MetaMask or another Web3 wallet', 'error');
        // Open MetaMask download page
        window.open('https://metamask.io/download/', '_blank');
        return;
    }

    try {
        const result = await Web3Integration.connectWeb3Wallet();
        handleWalletConnected(result.address, result.network);

        // Load on-chain predictions
        await loadOnChainPredictions();
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        showNotification(error.message || 'Failed to connect wallet', 'error');
    }
}

function handleWalletConnected(address, network) {
    state.connected = true;
    state.address = address;

    const shortAddress = Web3Integration.formatAddress(address);

    if (elements.connectWalletBtn) {
        elements.connectWalletBtn.innerHTML = `
            <span style="width: 8px; height: 8px; background: var(--color-success); border-radius: 50%;"></span>
            ${shortAddress}
        `;
    }

    // Show network badge
    const networkBadge = document.getElementById('networkBadge');
    const networkName = document.getElementById('networkName');
    if (networkBadge && networkName) {
        networkBadge.style.display = 'flex';
        networkName.textContent = Web3Integration.getNetworkName();

        // Check if on correct network
        if (!Web3Integration.isOnCorrectNetwork()) {
            networkBadge.classList.add('wrong-network');
            showNotification('Please switch to Sepolia testnet', 'warning');
        } else {
            networkBadge.classList.remove('wrong-network');
        }
    }

    updateSubmitButton();
}

// Setup Web3 event listeners
function setupWeb3EventListeners() {
    window.addEventListener('web3AccountChanged', (e) => {
        handleWalletConnected(e.detail.address, Web3Integration.state.network);
    });

    window.addEventListener('web3ChainChanged', (e) => {
        const networkBadge = document.getElementById('networkBadge');
        const networkName = document.getElementById('networkName');
        if (networkBadge && networkName) {
            networkName.textContent = Web3Integration.getNetworkName();
            if (!Web3Integration.isOnCorrectNetwork()) {
                networkBadge.classList.add('wrong-network');
                showNotification('Please switch to Sepolia testnet', 'warning');
            } else {
                networkBadge.classList.remove('wrong-network');
            }
        }
    });

    window.addEventListener('web3Disconnected', () => {
        state.connected = false;
        state.address = null;
        const networkBadge = document.getElementById('networkBadge');
        if (networkBadge) networkBadge.style.display = 'none';

        if (elements.connectWalletBtn) {
            elements.connectWalletBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" class="wallet-icon">
                    <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 13.5C16 14.3284 15.3284 15 14.5 15C13.6716 15 13 14.3284 13 13.5C13 12.6716 13.6716 12 14.5 12C15.3284 12 16 12.6716 16 13.5Z" fill="currentColor"/>
                    <path d="M6 6V5C6 3.89543 6.89543 3 8 3H18C19.1046 3 20 3.89543 20 5V6" stroke="currentColor" stroke-width="2"/>
                </svg>
                Connect Wallet
            `;
        }
        updateSubmitButton();
    });
}

async function loadOnChainPredictions() {
    if (!Web3Integration.state.contract) return;

    try {
        const onChainPredictions = await Web3Integration.getUserOnChainPredictions();
        // Merge with local predictions
        for (const pred of onChainPredictions) {
            const exists = state.predictions.find(p => p.onChainId === pred.id);
            if (!exists) {
                state.predictions.push({
                    id: pred.id,
                    onChainId: pred.id,
                    asset: pred.asset,
                    assetName: ASSETS[pred.asset]?.name || pred.asset,
                    startPrice: pred.startPrice,
                    predictedPrice: pred.predictedPrice,
                    stake: parseFloat(pred.stakeAmount),
                    createdAt: pred.createdAt.toISOString(),
                    endsAt: pred.expiresAt.toISOString(),
                    status: pred.settled ? (pred.won ? 'won' : 'lost') : 'pending',
                    isOnChain: true
                });
            }
        }
        renderPredictionsList();
    } catch (error) {
        console.error('Failed to load on-chain predictions:', error);
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    let notification = document.getElementById('web3Notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'web3Notification';
        notification.className = 'prediction-locked-notification';
        document.body.appendChild(notification);
    }

    // Set style based on type
    if (type === 'error') {
        notification.style.borderColor = 'var(--color-error)';
        notification.style.color = 'var(--color-error)';
    } else if (type === 'warning') {
        notification.style.borderColor = 'var(--color-warning)';
        notification.style.color = 'var(--color-warning)';
    } else {
        notification.style.borderColor = 'var(--color-accent-primary)';
        notification.style.color = 'var(--color-accent-primary)';
    }

    notification.innerHTML = `<span>${message}</span>`;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

// ================================================
// Utility Functions
// ================================================

function showLoading(show) {
    if (elements.chartLoading) {
        elements.chartLoading.classList.toggle('hidden', !show);
    }
}

function formatCurrency(value) {
    if (value >= 1000) {
        return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (value >= 1) {
        return '$' + value.toFixed(2);
    } else {
        return '$' + value.toFixed(4);
    }
}

function formatPrice(value) {
    if (value >= 1000) {
        return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (value >= 1) {
        return '$' + value.toFixed(2);
    } else {
        return '$' + value.toFixed(4);
    }
}

function getEndDate() {
    // Use the scroll-based expiry date if available
    if (state.expiryDate) {
        return new Date(state.expiryDate);
    }
    // Fallback to window config
    const config = WINDOWS[state.selectedWindow];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + config.days);
    return endDate;
}

function getTimeLeft(endDate) {
    const now = new Date();
    const diff = endDate - now;

    if (diff <= 0) return 'Ended';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize active tool
state.activeTool = 'draw';

// ================================================
// Auth State Change Handler (integrates with auth.js)
// ================================================

window.onAuthStateChange = function(authState) {
    if (authState.authenticated) {
        state.connected = true;
        state.address = authState.walletAddress;

        // Show network badge for wallet users
        const networkBadge = document.getElementById('networkBadge');
        if (networkBadge && authState.walletType === 'external') {
            networkBadge.style.display = 'flex';
        }

        updateSubmitButton();

        // Load on-chain predictions if external wallet
        if (authState.walletType === 'external' && Web3Integration?.state?.contract) {
            loadOnChainPredictions().catch(console.error);
        }
    } else {
        state.connected = false;
        state.address = null;
        const networkBadge = document.getElementById('networkBadge');
        if (networkBadge) networkBadge.style.display = 'none';
        updateSubmitButton();
    }
};

// Sync with auth state on load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const authState = window.InsiderAuth?.getAuthState();
        if (authState?.authenticated) {
            window.onAuthStateChange(authState);
        }
    }, 100);
});
