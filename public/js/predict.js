/**
 * insider.trading - Prediction Interface
 * Clean, minimal, functional
 */

// API Configuration
const API_BASE = window.CONFIG?.API_BASE || '/api';

// State
const state = {
    symbol: 'SPY',
    range: '1W',
    chart: null,
    series: null,
    chartData: [],
    currentPrice: 0,
    priceChange: 0,
    priceRange: { min: 0, max: 0 },
    drawing: false,
    drawPath: [],
    predictedPrice: null,
    expiryDays: 7,
    stakeAmount: 100
};

// DOM Elements
const el = {
    chartArea: document.getElementById('chartArea'),
    chartLoading: document.getElementById('chartLoading'),
    drawCanvas: document.getElementById('drawCanvas'),
    drawPrompt: document.getElementById('drawPrompt'),
    assetBtn: document.getElementById('assetBtn'),
    assetDropdown: document.getElementById('assetDropdown'),
    assetSymbol: document.getElementById('assetSymbol'),
    assetPrice: document.getElementById('assetPrice'),
    changeValue: document.getElementById('changeValue'),
    predictedPrice: document.getElementById('predictedPrice'),
    predictedChange: document.getElementById('predictedChange'),
    expiryDate: document.getElementById('expiryDate'),
    stakeInput: document.getElementById('stakeInput'),
    maxPayout: document.getElementById('maxPayout'),
    submitBtn: document.getElementById('submitBtn'),
    clearBtn: document.getElementById('clearBtn'),
    leaderboardBody: document.getElementById('leaderboardBody')
};

// Canvas context
let ctx = null;

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupCanvas();
    setupEventListeners();
    await loadChart();
    updateExpiryDisplay();
    loadLeaderboard();
}

function setupCanvas() {
    const canvas = el.drawCanvas;
    const container = el.chartArea;

    function resize() {
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        if (state.drawPath.length > 0) {
            redrawPath();
        }
    }

    resize();
    window.addEventListener('resize', resize);

    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function setupEventListeners() {
    // Asset picker
    el.assetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        el.assetBtn.parentElement.classList.toggle('open');
    });

    document.querySelectorAll('[data-symbol]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectAsset(btn.dataset.symbol);
        });
    });

    document.addEventListener('click', () => {
        el.assetBtn.parentElement.classList.remove('open');
    });

    // Time picker
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.addEventListener('click', () => {
            selectRange(btn.dataset.range);
        });
    });

    // Drawing
    el.drawCanvas.addEventListener('mousedown', startDrawing);
    el.drawCanvas.addEventListener('mousemove', draw);
    el.drawCanvas.addEventListener('mouseup', stopDrawing);
    el.drawCanvas.addEventListener('mouseleave', stopDrawing);

    // Touch support
    el.drawCanvas.addEventListener('touchstart', handleTouch(startDrawing));
    el.drawCanvas.addEventListener('touchmove', handleTouch(draw));
    el.drawCanvas.addEventListener('touchend', stopDrawing);

    // Stake input
    el.stakeInput.addEventListener('input', updatePayout);

    // Buttons
    el.clearBtn.addEventListener('click', clearDrawing);
    el.submitBtn.addEventListener('click', submitPrediction);

    // Leaderboard tabs
    document.querySelectorAll('.leaderboard-tabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.leaderboard-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadLeaderboard(btn.dataset.tab);
        });
    });
}

function handleTouch(fn) {
    return (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = el.drawCanvas.getBoundingClientRect();
        fn({
            offsetX: touch.clientX - rect.left,
            offsetY: touch.clientY - rect.top
        });
    };
}

// ============================================
// Chart Loading
// ============================================

async function loadChart() {
    showLoading(true);
    el.drawPrompt.classList.remove('visible');

    try {
        const response = await fetch(`${API_BASE}/prices/${state.symbol}?window=${state.range}`);
        const result = await response.json();

        if (!result.success || !result.data?.candles?.length) {
            throw new Error('No data received');
        }

        state.chartData = result.data.candles;
        state.currentPrice = result.data.lastPrice;
        state.priceChange = result.data.priceChange;

        // Calculate price range
        const prices = state.chartData.flatMap(c => [c.high, c.low]);
        state.priceRange.min = Math.min(...prices);
        state.priceRange.max = Math.max(...prices);

        updatePriceDisplay();
        renderChart();
        enableDrawing();

    } catch (error) {
        console.error('Failed to load chart:', error);
        el.chartArea.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">
                Failed to load data. <button onclick="loadChart()" style="margin-left:8px;padding:8px 16px;background:#00ff00;border:none;color:#000;cursor:pointer;">Retry</button>
            </div>
        `;
    }

    showLoading(false);
}

function renderChart() {
    // Clear existing chart
    if (state.chart) {
        state.chart.remove();
    }
    el.chartArea.innerHTML = '';

    const width = el.chartArea.offsetWidth;
    const height = el.chartArea.offsetHeight;

    state.chart = LightweightCharts.createChart(el.chartArea, {
        width,
        height,
        layout: {
            background: { type: 'solid', color: '#0a0a0a' },
            textColor: '#888'
        },
        grid: {
            vertLines: { color: '#1a1a1a' },
            horzLines: { color: '#1a1a1a' }
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: { color: '#00ff00', width: 1, style: 2 },
            horzLine: { color: '#00ff00', width: 1, style: 2 }
        },
        rightPriceScale: {
            borderColor: '#222',
            scaleMargins: { top: 0.1, bottom: 0.2 }
        },
        timeScale: {
            borderColor: '#222',
            timeVisible: true,
            secondsVisible: false
        }
    });

    // Add line series
    state.series = state.chart.addLineSeries({
        color: '#00ff00',
        lineWidth: 2,
        lastValueVisible: true,
        priceLineVisible: true,
        priceLineColor: '#00ff00',
        priceLineWidth: 1,
        priceLineStyle: 2
    });

    // Convert to line data
    const lineData = state.chartData
        .filter(c => c.time && c.close && !isNaN(c.close))
        .map(c => ({ time: c.time, value: c.close }));

    state.series.setData(lineData);
    state.chart.timeScale().fitContent();

    // Handle resize
    new ResizeObserver(() => {
        state.chart.applyOptions({
            width: el.chartArea.offsetWidth,
            height: el.chartArea.offsetHeight
        });
    }).observe(el.chartArea);
}

function enableDrawing() {
    el.drawCanvas.classList.add('active');
    el.drawPrompt.classList.add('visible');
}

function showLoading(show) {
    el.chartLoading.classList.toggle('hidden', !show);
}

function updatePriceDisplay() {
    el.assetSymbol.textContent = state.symbol.replace('-USD', '');
    el.assetPrice.textContent = formatPrice(state.currentPrice);

    const changeStr = `${state.priceChange >= 0 ? '+' : ''}${state.priceChange.toFixed(2)}%`;
    el.changeValue.textContent = changeStr;
    el.changeValue.className = `change-value ${state.priceChange >= 0 ? 'positive' : 'negative'}`;
}

// ============================================
// Asset & Range Selection
// ============================================

function selectAsset(symbol) {
    if (state.symbol === symbol) return;

    state.symbol = symbol;
    clearDrawing();
    loadChart();
    el.assetBtn.parentElement.classList.remove('open');
}

function selectRange(range) {
    if (state.range === range) return;

    state.range = range;
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });

    // Update expiry days based on range
    const expiryMap = { '1D': 1, '1W': 7, '1M': 30, '1Y': 365, '5Y': 1825 };
    state.expiryDays = expiryMap[range] || 7;

    clearDrawing();
    loadChart();
    updateExpiryDisplay();
}

// ============================================
// Drawing
// ============================================

function startDrawing(e) {
    if (!state.chartData.length) return;

    state.drawing = true;
    state.drawPath = [];
    el.drawPrompt.classList.remove('visible');

    const point = getDrawPoint(e);
    state.drawPath.push(point);

    ctx.clearRect(0, 0, el.drawCanvas.width, el.drawCanvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.moveTo(point.x, point.y);
}

function draw(e) {
    if (!state.drawing) return;

    const point = getDrawPoint(e);

    // Only allow drawing forward (left to right)
    const lastPoint = state.drawPath[state.drawPath.length - 1];
    if (point.x <= lastPoint.x) return;

    state.drawPath.push(point);

    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    // Update predicted price
    updatePrediction();
}

function stopDrawing() {
    if (!state.drawing) return;
    state.drawing = false;

    if (state.drawPath.length > 5) {
        updatePrediction();
        enableSubmit(true);
    }
}

function getDrawPoint(e) {
    return {
        x: e.offsetX,
        y: e.offsetY
    };
}

function redrawPath() {
    if (!state.drawPath.length) return;

    ctx.clearRect(0, 0, el.drawCanvas.width, el.drawCanvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.moveTo(state.drawPath[0].x, state.drawPath[0].y);

    for (let i = 1; i < state.drawPath.length; i++) {
        ctx.lineTo(state.drawPath[i].x, state.drawPath[i].y);
    }
    ctx.stroke();
}

function clearDrawing() {
    state.drawPath = [];
    state.predictedPrice = null;
    ctx.clearRect(0, 0, el.drawCanvas.width, el.drawCanvas.height);

    el.predictedPrice.textContent = '--';
    el.predictedChange.textContent = '';
    el.predictedChange.className = 'predict-change';

    enableSubmit(false);

    if (state.chartData.length) {
        el.drawPrompt.classList.add('visible');
    }
}

// ============================================
// Prediction Calculation
// ============================================

function updatePrediction() {
    if (state.drawPath.length < 2) return;

    const lastPoint = state.drawPath[state.drawPath.length - 1];
    const canvasHeight = el.drawCanvas.height;

    // Convert Y position to price (inverted - top is high, bottom is low)
    const priceRangePadded = (state.priceRange.max - state.priceRange.min) * 1.3;
    const minPricePadded = state.priceRange.min - (priceRangePadded * 0.15);

    const priceRatio = 1 - (lastPoint.y / canvasHeight);
    state.predictedPrice = minPricePadded + (priceRatio * priceRangePadded);

    // Update display
    el.predictedPrice.textContent = formatPrice(state.predictedPrice);

    const change = ((state.predictedPrice - state.currentPrice) / state.currentPrice) * 100;
    el.predictedChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    el.predictedChange.className = `predict-change ${change >= 0 ? 'positive' : 'negative'}`;
}

function updateExpiryDisplay() {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + state.expiryDays);
    el.expiryDate.textContent = expiry.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function updatePayout() {
    state.stakeAmount = parseInt(el.stakeInput.value) || 0;
    const maxPayout = state.stakeAmount * 10;
    el.maxPayout.textContent = formatNumber(maxPayout) + ' INSD';
}

function enableSubmit(enabled) {
    el.submitBtn.disabled = !enabled;
    el.submitBtn.querySelector('span').textContent = enabled
        ? `Stake ${state.stakeAmount} INSD`
        : 'Draw prediction to continue';
}

// ============================================
// Submission
// ============================================

async function submitPrediction() {
    if (!state.predictedPrice || !state.drawPath.length) return;

    el.submitBtn.disabled = true;
    el.submitBtn.querySelector('span').textContent = 'Submitting...';

    try {
        // For now, store locally (would connect to blockchain)
        const prediction = {
            id: Date.now(),
            symbol: state.symbol,
            currentPrice: state.currentPrice,
            predictedPrice: state.predictedPrice,
            stake: state.stakeAmount,
            path: state.drawPath,
            expiry: new Date(Date.now() + state.expiryDays * 24 * 60 * 60 * 1000),
            created: new Date(),
            trader: '0x' + Math.random().toString(16).slice(2, 10) + '...'
        };

        // Store in localStorage
        const predictions = JSON.parse(localStorage.getItem('predictions') || '[]');
        predictions.unshift(prediction);
        localStorage.setItem('predictions', JSON.stringify(predictions));

        // Show success
        el.submitBtn.querySelector('span').textContent = 'Prediction Submitted!';

        setTimeout(() => {
            clearDrawing();
            loadLeaderboard();
        }, 1500);

    } catch (error) {
        console.error('Failed to submit:', error);
        el.submitBtn.querySelector('span').textContent = 'Failed - Try Again';
        el.submitBtn.disabled = false;
    }
}

// ============================================
// Leaderboard
// ============================================

function loadLeaderboard(tab = 'active') {
    const predictions = JSON.parse(localStorage.getItem('predictions') || '[]');

    if (predictions.length === 0) {
        el.leaderboardBody.innerHTML = '<div class="empty-state">No predictions yet. Be the first!</div>';
        return;
    }

    const now = new Date();
    let filtered = predictions;

    if (tab === 'active') {
        filtered = predictions.filter(p => new Date(p.expiry) > now);
    } else if (tab === 'settled') {
        filtered = predictions.filter(p => new Date(p.expiry) <= now);
    }

    const html = filtered.slice(0, 20).map(p => {
        const change = ((p.predictedPrice - p.currentPrice) / p.currentPrice) * 100;
        const isExpired = new Date(p.expiry) <= now;
        const status = isExpired ? (Math.random() > 0.5 ? 'won' : 'lost') : 'active';

        return `
            <div class="leaderboard-row">
                <div class="trader-cell">
                    <div class="trader-avatar">${p.trader.slice(2, 4).toUpperCase()}</div>
                    <span class="trader-address">${p.trader}</span>
                </div>
                <div>${p.symbol.replace('-USD', '')}</div>
                <div class="prediction-cell">
                    <span class="prediction-target">${formatPrice(p.predictedPrice)}</span>
                    <span class="prediction-change ${change >= 0 ? 'positive' : 'negative'}">
                        ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
                    </span>
                </div>
                <div>${formatNumber(p.stake)} INSD</div>
                <div><span class="status-badge ${status}">${status}</span></div>
            </div>
        `;
    }).join('');

    el.leaderboardBody.innerHTML = html || '<div class="empty-state">No predictions in this category.</div>';
}

// ============================================
// Utilities
// ============================================

function formatPrice(price) {
    if (!price || isNaN(price)) return '--';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: price < 10 ? 2 : 0,
        maximumFractionDigits: price < 10 ? 4 : 2
    }).format(price);
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}
