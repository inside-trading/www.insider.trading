// ================================================
// Predictions Page - Main Application
// ================================================

const API_BASE = '/api';

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
    chartType: 'candlestick',
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
    visiblePriceRange: { min: 0, max: 0 }
};

// DOM Elements
const elements = {
    assetSelect: document.getElementById('assetSelect'),
    windowSelect: document.getElementById('windowSelect'),
    stakeAmount: document.getElementById('stakeAmount'),
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
    eraseBtn: document.getElementById('eraseBtn'),
    clearBtn: document.getElementById('clearBtn'),
    undoBtn: document.getElementById('undoBtn'),
    timelineScrollContainer: document.getElementById('timelineScrollContainer'),
    timelineContent: document.getElementById('timelineContent'),
    nowDivider: document.getElementById('nowDivider'),
    unifiedXAxis: document.getElementById('unifiedXAxis'),
    predictionArea: document.getElementById('predictionArea')
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
    await loadChartData();
    loadPredictions();
    updatePayoffDisplay();

    // Scroll to show "Now" divider in view
    scrollToNow();
}

// ================================================
// Event Listeners
// ================================================

function setupEventListeners() {
    // Asset and window selection
    elements.assetSelect?.addEventListener('change', handleAssetChange);
    elements.windowSelect?.addEventListener('change', handleWindowChange);
    elements.stakeAmount?.addEventListener('input', handleStakeChange);

    // Chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', () => handleChartTypeChange(btn.dataset.type));
    });

    // Drawing tools
    elements.drawBtn?.addEventListener('click', () => setActiveTool('draw'));
    elements.eraseBtn?.addEventListener('click', () => setActiveTool('erase'));
    elements.clearBtn?.addEventListener('click', clearDrawing);
    elements.undoBtn?.addEventListener('click', undoDrawing);

    // Canvas events
    setupCanvasEvents();

    // Submit button
    elements.submitPredictionBtn?.addEventListener('click', submitPrediction);

    // Wallet connection
    elements.connectWalletBtn?.addEventListener('click', connectWallet);

    // Window resize
    window.addEventListener('resize', debounce(handleResize, 250));
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
            const priceScale = state.chart.priceScale('right');
            // Use chart data to calculate range
            const prices = state.chartData.flatMap(d => [d.high, d.low]);
            if (prices.length > 0) {
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                // Add some padding for drawing above/below
                const padding = (maxPrice - minPrice) * 0.3;
                state.visiblePriceRange = {
                    min: minPrice - padding,
                    max: maxPrice + padding
                };
                priceRange.min = state.visiblePriceRange.min;
                priceRange.max = state.visiblePriceRange.max;
            }
        } catch (e) {
            // Fallback to chart data range
            const prices = state.chartData.flatMap(d => [d.high, d.low]);
            priceRange.min = Math.min(...prices) * 0.9;
            priceRange.max = Math.max(...prices) * 1.1;
        }
    }
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

    // Draw starting price line
    const startY = priceToY(state.lastPrice);
    ctx.strokeStyle = 'rgba(0, 212, 170, 0.5)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, startY);
    ctx.lineTo(width, startY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw starting point
    ctx.fillStyle = '#00D4AA';
    ctx.beginPath();
    ctx.arc(0, startY, 6, 0, Math.PI * 2);
    ctx.fill();
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
    const config = WINDOWS[state.selectedWindow];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + config.days);

    if (elements.predictionEnds) {
        elements.predictionEnds.textContent = endDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
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

    if (state.predictedPrice !== null) {
        const changePercent = Math.abs((state.predictedPrice - state.lastPrice) / state.lastPrice) * 100;
        const multiplier = calculateMultiplier(changePercent);
        const potentialWin = stake * multiplier;

        if (elements.potentialPayoff) {
            elements.potentialPayoff.textContent = `${potentialWin.toLocaleString()} USDC`;
        }

        if (elements.payoffMultiplier) {
            elements.payoffMultiplier.textContent = `${multiplier}x multiplier`;
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

function calculateMultiplier(errorPercent) {
    // Scoring tiers based on prediction accuracy
    if (errorPercent <= 1) return 10;
    if (errorPercent <= 2.5) return 5;
    if (errorPercent <= 5) return 2;
    if (errorPercent <= 10) return 1;
    return 0;
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
        connectWallet();
        return;
    }

    if (!state.predictedPrice) {
        alert('Please draw your prediction first');
        return;
    }

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
        drawingPath: [...state.drawingPath]
    };

    try {
        // Save to backend
        const result = await savePrediction(prediction);

        // Add to local state
        state.predictions.unshift(prediction);

        // Update UI
        renderPredictionsList();
        clearDrawing();

        alert('Prediction submitted successfully!');
    } catch (error) {
        console.error('Failed to submit prediction:', error);
        alert('Failed to submit prediction. Please try again.');
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

async function handleAssetChange(e) {
    state.selectedAsset = e.target.value;
    clearDrawing();
    await loadChartData();
    scrollToNow();
}

async function handleWindowChange(e) {
    state.selectedWindow = e.target.value;
    clearDrawing();
    await loadChartData();
    scrollToNow();
}

function handleStakeChange(e) {
    state.stakeAmount = parseFloat(e.target.value) || 0;
    updatePayoffDisplay();
    updateSubmitButton();
}

function handleChartTypeChange(type) {
    state.chartType = type;

    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    renderChart();
}

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
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            handleWalletConnected(accounts[0]);
        } catch (error) {
            console.error('Failed to connect wallet:', error);
        }
    } else {
        // Mock connection
        const mockAddress = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
        handleWalletConnected(mockAddress);
    }
}

function handleWalletConnected(address) {
    state.connected = true;
    state.address = address;

    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    if (elements.connectWalletBtn) {
        elements.connectWalletBtn.innerHTML = `
            <span style="width: 8px; height: 8px; background: var(--color-success); border-radius: 50%;"></span>
            ${shortAddress}
        `;
    }

    updateSubmitButton();
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

function getEndDate() {
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
