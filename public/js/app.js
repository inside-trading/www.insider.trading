// ================================================
// Insider Trading DEX - Main Application
// ================================================

// API Configuration
const API_BASE = '/api';
const WS_URL = `ws://${window.location.host}/ws`;

// Application State
const state = {
    connected: false,
    address: null,
    network: null,
    tokens: [],
    pools: [],
    prices: {},
    fromToken: null,
    toToken: null,
    fromAmount: '',
    toAmount: '',
    slippage: 0.5,
    deadline: 20,
    selectingToken: null,
    quote: null,
    ws: null,
    wsConnected: false
};

// Network Data (static)
const NETWORKS = [
    { id: 1, name: 'Ethereum', icon: '/assets/networks/ethereum.svg', rpc: 'https://mainnet.infura.io' },
    { id: 42161, name: 'Arbitrum', icon: '/assets/networks/arbitrum.svg', rpc: 'https://arb1.arbitrum.io/rpc' },
    { id: 10, name: 'Optimism', icon: '/assets/networks/optimism.svg', rpc: 'https://mainnet.optimism.io' },
    { id: 137, name: 'Polygon', icon: '/assets/networks/polygon.svg', rpc: 'https://polygon-rpc.com' },
    { id: 56, name: 'BNB Chain', icon: '/assets/networks/bnb.svg', rpc: 'https://bsc-dataseed.binance.org' },
    { id: 8453, name: 'Base', icon: '/assets/networks/base.svg', rpc: 'https://mainnet.base.org' },
];

// Wallet Data (static)
const WALLETS = [
    { id: 'metamask', name: 'MetaMask', icon: '/assets/wallets/metamask.svg', tag: 'Popular' },
    { id: 'walletconnect', name: 'WalletConnect', icon: '/assets/wallets/walletconnect.svg', tag: '' },
    { id: 'coinbase', name: 'Coinbase Wallet', icon: '/assets/wallets/coinbase.svg', tag: '' },
    { id: 'trust', name: 'Trust Wallet', icon: '/assets/wallets/trust.svg', tag: '' },
    { id: 'rainbow', name: 'Rainbow', icon: '/assets/wallets/rainbow.svg', tag: '' },
];

// DOM Elements
const elements = {
    connectWalletBtn: document.getElementById('connectWalletBtn'),
    networkBtn: document.getElementById('networkBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    swapDirectionBtn: document.getElementById('swapDirectionBtn'),
    swapBtn: document.getElementById('swapBtn'),
    fromTokenBtn: document.getElementById('fromTokenBtn'),
    toTokenBtn: document.getElementById('toTokenBtn'),
    ctaConnectBtn: document.getElementById('ctaConnectBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    fromAmount: document.getElementById('fromAmount'),
    toAmount: document.getElementById('toAmount'),
    tokenSearch: document.getElementById('tokenSearch'),
    tokenModalSearch: document.getElementById('tokenModalSearch'),
    fromTokenIcon: document.getElementById('fromTokenIcon'),
    fromTokenSymbol: document.getElementById('fromTokenSymbol'),
    toTokenIcon: document.getElementById('toTokenIcon'),
    toTokenSymbol: document.getElementById('toTokenSymbol'),
    fromBalance: document.getElementById('fromBalance'),
    toBalance: document.getElementById('toBalance'),
    fromUsdValue: document.getElementById('fromUsdValue'),
    toUsdValue: document.getElementById('toUsdValue'),
    swapRate: document.getElementById('swapRate'),
    priceImpact: document.getElementById('priceImpact'),
    minReceived: document.getElementById('minReceived'),
    networkFee: document.getElementById('networkFee'),
    networkName: document.querySelector('.network-name'),
    settingsPanel: document.getElementById('settingsPanel'),
    tokenModal: document.getElementById('tokenModal'),
    networkModal: document.getElementById('networkModal'),
    walletModal: document.getElementById('walletModal'),
    mobileMenu: document.getElementById('mobileMenu'),
    tokenList: document.getElementById('tokenList'),
    commonTokensList: document.getElementById('commonTokensList'),
    networkList: document.getElementById('networkList'),
    walletList: document.getElementById('walletList'),
    poolsTableBody: document.getElementById('poolsTableBody'),
    tokensGrid: document.getElementById('tokensGrid'),
    closeTokenModal: document.getElementById('closeTokenModal'),
    closeNetworkModal: document.getElementById('closeNetworkModal'),
    closeWalletModal: document.getElementById('closeWalletModal'),
};

// ================================================
// API Functions
// ================================================

async function api(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'API request failed');
        }

        return data.data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

async function fetchTokens() {
    try {
        state.tokens = await api('/tokens');
        if (state.tokens.length >= 2) {
            state.fromToken = state.tokens[0];
            state.toToken = state.tokens[1];
        }
    } catch (error) {
        console.error('Failed to fetch tokens:', error);
        // Fallback to empty array
        state.tokens = [];
    }
}

async function fetchPools() {
    try {
        state.pools = await api('/pools?sortBy=tvl&limit=5');
    } catch (error) {
        console.error('Failed to fetch pools:', error);
        state.pools = [];
    }
}

async function fetchPrices() {
    try {
        state.prices = await api('/tokens/prices');
    } catch (error) {
        console.error('Failed to fetch prices:', error);
    }
}

async function fetchPlatformStats() {
    try {
        return await api('/pools/stats');
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        return null;
    }
}

async function getSwapQuote(fromToken, toToken, amount, slippage) {
    try {
        const quote = await api('/swap/quote', {
            method: 'POST',
            body: JSON.stringify({ fromToken, toToken, amount, slippage })
        });
        state.quote = quote;
        return quote;
    } catch (error) {
        console.error('Failed to get quote:', error);
        return null;
    }
}

async function executeSwap(quote, userAddress) {
    try {
        return await api('/swap/execute', {
            method: 'POST',
            body: JSON.stringify({
                quoteId: quote.id,
                userAddress
            })
        });
    } catch (error) {
        console.error('Failed to execute swap:', error);
        throw error;
    }
}

// ================================================
// WebSocket
// ================================================

function connectWebSocket() {
    try {
        state.ws = new WebSocket(WS_URL);

        state.ws.onopen = () => {
            console.log('WebSocket connected');
            state.wsConnected = true;

            // Subscribe to price updates
            state.ws.send(JSON.stringify({
                type: 'subscribe',
                channel: 'prices'
            }));
        };

        state.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                handleWebSocketMessage(message);
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        state.ws.onclose = () => {
            console.log('WebSocket disconnected');
            state.wsConnected = false;

            // Reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
        };

        state.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
    }
}

function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'prices':
            state.prices = message.data;
            updatePricesInUI();
            break;

        case 'connected':
            console.log('WebSocket client ID:', message.clientId);
            break;

        case 'subscribed':
            console.log('Subscribed to:', message.channel);
            break;

        default:
            console.log('Unknown WebSocket message:', message.type);
    }
}

function updatePricesInUI() {
    // Update token prices in state
    state.tokens.forEach(token => {
        if (state.prices[token.symbol]) {
            token.price = state.prices[token.symbol].price;
            token.priceChange24h = state.prices[token.symbol].change24h;
        }
    });

    // Update token cards
    const cards = document.querySelectorAll('.token-card');
    cards.forEach(card => {
        const symbol = card.dataset.symbol;
        const priceData = state.prices[symbol];
        if (priceData) {
            const priceEl = card.querySelector('.token-card-price-value');
            const changeEl = card.querySelector('.token-card-change');
            if (priceEl) priceEl.textContent = `$${formatPrice(priceData.price)}`;
            if (changeEl) {
                changeEl.textContent = `${priceData.change24h >= 0 ? '+' : ''}${priceData.change24h.toFixed(2)}%`;
                changeEl.className = `token-card-change ${priceData.change24h >= 0 ? 'positive' : 'negative'}`;
            }
        }
    });

    // Recalculate swap if amounts are entered
    if (state.fromAmount && parseFloat(state.fromAmount) > 0) {
        calculateSwap();
    }
}

// ================================================
// Initialization
// ================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});

async function initializeApp() {
    // Set default network
    state.network = NETWORKS[0];

    // Fetch data from API
    await Promise.all([
        fetchTokens(),
        fetchPools(),
        fetchPrices()
    ]);

    // Connect WebSocket for real-time updates
    connectWebSocket();

    // Render UI
    renderTokens();
    renderPools();
    renderTokenCards();
    renderNetworks();
    renderWallets();
    renderCommonTokens();
    updateSwapUI();
    setupEventListeners();

    // Fetch and display platform stats
    updatePlatformStats();
}

async function updatePlatformStats() {
    const stats = await fetchPlatformStats();
    if (stats) {
        // Update stats display
        const statValues = document.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
            const label = stat.closest('.stat')?.querySelector('.stat-label')?.textContent;
            if (label?.includes('Volume')) {
                stat.dataset.value = (stats.totalVolume24h / 1000000000).toFixed(1);
            }
        });
    }
    animateStats();
}

// ================================================
// Event Listeners
// ================================================

function setupEventListeners() {
    elements.connectWalletBtn?.addEventListener('click', openWalletModal);
    elements.ctaConnectBtn?.addEventListener('click', openWalletModal);
    elements.networkBtn?.addEventListener('click', openNetworkModal);
    elements.settingsBtn?.addEventListener('click', toggleSettings);
    elements.swapDirectionBtn?.addEventListener('click', swapTokens);
    elements.fromTokenBtn?.addEventListener('click', () => openTokenModal('from'));
    elements.toTokenBtn?.addEventListener('click', () => openTokenModal('to'));
    elements.fromAmount?.addEventListener('input', handleFromAmountChange);
    elements.tokenModalSearch?.addEventListener('input', handleTokenSearch);
    elements.tokenSearch?.addEventListener('input', handleTokenGridSearch);
    elements.closeTokenModal?.addEventListener('click', closeTokenModal);
    elements.closeNetworkModal?.addEventListener('click', closeNetworkModal);
    elements.closeWalletModal?.addEventListener('click', closeWalletModal);

    elements.tokenModal?.addEventListener('click', (e) => {
        if (e.target === elements.tokenModal) closeTokenModal();
    });
    elements.networkModal?.addEventListener('click', (e) => {
        if (e.target === elements.networkModal) closeNetworkModal();
    });
    elements.walletModal?.addEventListener('click', (e) => {
        if (e.target === elements.walletModal) closeWalletModal();
    });

    elements.swapBtn?.addEventListener('click', handleSwap);
    elements.mobileMenuBtn?.addEventListener('click', toggleMobileMenu);

    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickAmount);
    });

    document.querySelectorAll('.slippage-btn').forEach(btn => {
        btn.addEventListener('click', handleSlippageSelect);
    });

    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAllModals();
    });
}

// ================================================
// Rendering Functions
// ================================================

function renderTokens() {
    if (!elements.tokenList) return;

    elements.tokenList.innerHTML = state.tokens.map(token => `
        <div class="token-list-item" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" onerror="this.src='/assets/tokens/default.svg'">
            <div class="token-list-item-info">
                <div class="token-list-item-symbol">${token.symbol}</div>
                <div class="token-list-item-name">${token.name}</div>
            </div>
            <div class="token-list-item-balance">
                <div class="token-list-item-amount">${(token.balance || 0).toFixed(4)}</div>
                <div class="token-list-item-value">$${((token.balance || 0) * token.price).toFixed(2)}</div>
            </div>
        </div>
    `).join('');

    elements.tokenList.querySelectorAll('.token-list-item').forEach(item => {
        item.addEventListener('click', () => selectToken(item.dataset.symbol));
    });
}

function renderCommonTokens() {
    if (!elements.commonTokensList) return;

    const commonSymbols = ['ETH', 'USDC', 'USDT', 'BTC'];
    const commonTokens = state.tokens.filter(t => commonSymbols.includes(t.symbol));

    elements.commonTokensList.innerHTML = commonTokens.map(token => `
        <button class="common-token-btn" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" onerror="this.src='/assets/tokens/default.svg'">
            ${token.symbol}
        </button>
    `).join('');

    elements.commonTokensList.querySelectorAll('.common-token-btn').forEach(btn => {
        btn.addEventListener('click', () => selectToken(btn.dataset.symbol));
    });
}

function renderPools() {
    if (!elements.poolsTableBody) return;

    elements.poolsTableBody.innerHTML = state.pools.map(pool => `
        <tr>
            <td>
                <div class="pool-pair">
                    <div class="pool-icons">
                        <img src="${pool.token0Data?.icon || '/assets/tokens/default.svg'}" alt="${pool.token0}">
                        <img src="${pool.token1Data?.icon || '/assets/tokens/default.svg'}" alt="${pool.token1}">
                    </div>
                    <div>
                        <div class="pool-names">${pool.token0}/${pool.token1}</div>
                        <div class="pool-fee-badge">${(pool.fee * 100).toFixed(2)}%</div>
                    </div>
                </div>
            </td>
            <td class="pool-tvl">$${formatLargeNumber(pool.tvl)}</td>
            <td class="pool-volume">$${formatLargeNumber(pool.volume24h)}</td>
            <td class="pool-apr">${pool.apr.toFixed(1)}%</td>
            <td>
                <button class="pool-action-btn">Add Liquidity</button>
            </td>
        </tr>
    `).join('');
}

function renderTokenCards() {
    if (!elements.tokensGrid) return;

    elements.tokensGrid.innerHTML = state.tokens.map(token => `
        <div class="token-card" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" class="token-card-icon" onerror="this.src='/assets/tokens/default.svg'">
            <div class="token-card-info">
                <div class="token-card-name">${token.name}</div>
                <div class="token-card-symbol">${token.symbol}</div>
            </div>
            <div class="token-card-price">
                <div class="token-card-price-value">$${formatPrice(token.price)}</div>
                <div class="token-card-change ${token.priceChange24h >= 0 ? 'positive' : 'negative'}">
                    ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%
                </div>
            </div>
        </div>
    `).join('');

    elements.tokensGrid.querySelectorAll('.token-card').forEach(card => {
        card.addEventListener('click', () => {
            const symbol = card.dataset.symbol;
            state.fromToken = state.tokens.find(t => t.symbol === symbol) || state.tokens[0];
            state.toToken = state.tokens.find(t => t.symbol === 'USDC') || state.tokens[1];
            updateSwapUI();
            document.getElementById('swap')?.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function renderNetworks() {
    if (!elements.networkList) return;

    elements.networkList.innerHTML = NETWORKS.map(network => `
        <div class="network-list-item ${network.id === state.network?.id ? 'active' : ''}" data-id="${network.id}">
            <img src="${network.icon}" alt="${network.name}" onerror="this.src='/assets/networks/default.svg'">
            <span class="network-list-item-name">${network.name}</span>
            <svg class="network-list-item-check" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    `).join('');

    elements.networkList.querySelectorAll('.network-list-item').forEach(item => {
        item.addEventListener('click', () => selectNetwork(parseInt(item.dataset.id)));
    });
}

function renderWallets() {
    if (!elements.walletList) return;

    elements.walletList.innerHTML = WALLETS.map(wallet => `
        <div class="wallet-list-item" data-id="${wallet.id}">
            <img src="${wallet.icon}" alt="${wallet.name}" onerror="this.src='/assets/wallets/default.svg'">
            <span class="wallet-list-item-name">${wallet.name}</span>
            ${wallet.tag ? `<span class="wallet-list-item-tag">${wallet.tag}</span>` : ''}
        </div>
    `).join('');

    elements.walletList.querySelectorAll('.wallet-list-item').forEach(item => {
        item.addEventListener('click', () => connectWallet(item.dataset.id));
    });
}

// ================================================
// Swap Functions
// ================================================

function updateSwapUI() {
    if (!state.fromToken || !state.toToken) return;

    if (elements.fromTokenIcon) elements.fromTokenIcon.src = state.fromToken.icon;
    if (elements.fromTokenSymbol) elements.fromTokenSymbol.textContent = state.fromToken.symbol;
    if (elements.toTokenIcon) elements.toTokenIcon.src = state.toToken.icon;
    if (elements.toTokenSymbol) elements.toTokenSymbol.textContent = state.toToken.symbol;

    if (elements.fromBalance) elements.fromBalance.textContent = (state.fromToken.balance || 0).toFixed(4);
    if (elements.toBalance) elements.toBalance.textContent = (state.toToken.balance || 0).toFixed(4);

    calculateSwap();
    updateSwapButton();
    updateRouteDisplay();
}

async function calculateSwap() {
    if (!state.fromToken || !state.toToken) return;

    const fromAmount = parseFloat(state.fromAmount) || 0;

    if (fromAmount > 0) {
        // Get quote from API
        const quote = await getSwapQuote(
            state.fromToken.symbol,
            state.toToken.symbol,
            fromAmount,
            state.slippage
        );

        if (quote) {
            state.toAmount = quote.toAmount.toFixed(6);
            state.quote = quote;

            if (elements.toAmount) elements.toAmount.value = state.toAmount;
            if (elements.fromUsdValue) elements.fromUsdValue.textContent = (fromAmount * state.fromToken.price).toFixed(2);
            if (elements.toUsdValue) elements.toUsdValue.textContent = (quote.toAmount * state.toToken.price).toFixed(2);
            if (elements.swapRate) elements.swapRate.textContent = `1 ${state.fromToken.symbol} = ${quote.rate.toFixed(4)} ${state.toToken.symbol}`;
            if (elements.minReceived) elements.minReceived.textContent = `${quote.minReceived.toFixed(4)} ${state.toToken.symbol}`;
            if (elements.priceImpact) {
                elements.priceImpact.textContent = `${quote.priceImpact.toFixed(2)}%`;
                elements.priceImpact.className = `detail-value ${quote.priceImpact < 1 ? 'positive' : quote.priceImpact < 3 ? '' : 'negative'}`;
            }
            if (elements.networkFee) elements.networkFee.textContent = `~$${quote.gasFee.toFixed(2)}`;
        }
    } else {
        state.toAmount = '';
        state.quote = null;
        if (elements.toAmount) elements.toAmount.value = '';
        if (elements.fromUsdValue) elements.fromUsdValue.textContent = '0.00';
        if (elements.toUsdValue) elements.toUsdValue.textContent = '0.00';
    }
}

function handleFromAmountChange(e) {
    state.fromAmount = e.target.value;
    calculateSwap();
    updateSwapButton();
}

function swapTokens() {
    const temp = state.fromToken;
    state.fromToken = state.toToken;
    state.toToken = temp;

    state.fromAmount = state.toAmount;
    if (elements.fromAmount) elements.fromAmount.value = state.fromAmount;

    updateSwapUI();
}

function updateSwapButton() {
    if (!elements.swapBtn) return;

    const btnText = elements.swapBtn.querySelector('.swap-btn-text') || elements.swapBtn;

    if (!state.connected) {
        btnText.textContent = 'Connect Wallet to Swap';
        elements.swapBtn.disabled = false;
    } else if (!state.fromAmount || parseFloat(state.fromAmount) === 0) {
        btnText.textContent = 'Enter an amount';
        elements.swapBtn.disabled = true;
    } else if (parseFloat(state.fromAmount) > (state.fromToken?.balance || 0)) {
        btnText.textContent = `Insufficient ${state.fromToken?.symbol || ''} balance`;
        elements.swapBtn.disabled = true;
    } else {
        btnText.textContent = 'Swap';
        elements.swapBtn.disabled = false;
    }
}

function updateRouteDisplay() {
    const routePath = document.getElementById('routePath');
    if (!routePath || !state.fromToken || !state.toToken) return;

    const route = state.quote?.route || [{ poolName: 'Insider V2', fee: 0.003 }];

    routePath.innerHTML = `
        <div class="route-token">
            <img src="${state.fromToken.icon}" alt="${state.fromToken.symbol}" onerror="this.src='/assets/tokens/default.svg'">
            <span>${state.fromToken.symbol}</span>
        </div>
        <svg class="route-arrow" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="route-pool">
            <span class="pool-name">${route[0]?.poolName || 'Insider V2'}</span>
            <span class="pool-fee">${((route[0]?.fee || 0.003) * 100).toFixed(1)}%</span>
        </div>
        <svg class="route-arrow" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="route-token">
            <img src="${state.toToken.icon}" alt="${state.toToken.symbol}" onerror="this.src='/assets/tokens/default.svg'">
            <span>${state.toToken.symbol}</span>
        </div>
    `;
}

async function handleSwap() {
    if (!state.connected) {
        openWalletModal();
        return;
    }

    if (!state.quote) {
        alert('Please enter an amount first');
        return;
    }

    const btnText = elements.swapBtn.querySelector('.swap-btn-text') || elements.swapBtn;
    btnText.textContent = 'Swapping...';
    elements.swapBtn.disabled = true;

    try {
        const result = await executeSwap(state.quote, state.address);

        if (result.status === 'pending') {
            // Wait for confirmation
            btnText.textContent = 'Confirming...';

            // Poll for status
            const checkStatus = async () => {
                const swap = await api(`/swap/${result.id}`);
                if (swap.status === 'completed') {
                    alert(`Swap successful!\n\nTransaction: ${swap.txHash}\n\nSwapped ${state.fromAmount} ${state.fromToken.symbol} for ${state.toAmount} ${state.toToken.symbol}`);
                    state.fromAmount = '';
                    state.toAmount = '';
                    state.quote = null;
                    if (elements.fromAmount) elements.fromAmount.value = '';
                    if (elements.toAmount) elements.toAmount.value = '';
                    updateSwapUI();
                } else {
                    setTimeout(checkStatus, 1000);
                }
            };
            setTimeout(checkStatus, 1000);
        }
    } catch (error) {
        alert(`Swap failed: ${error.message}`);
        updateSwapButton();
    }
}

function handleQuickAmount(e) {
    if (!state.connected || !state.fromToken) return;

    const percent = parseInt(e.target.dataset.percent);
    const amount = ((state.fromToken.balance || 0) * percent / 100).toFixed(6);
    state.fromAmount = amount;
    if (elements.fromAmount) elements.fromAmount.value = amount;
    calculateSwap();
    updateSwapButton();
}

// ================================================
// Token Selection
// ================================================

function openTokenModal(type) {
    state.selectingToken = type;
    elements.tokenModal?.classList.add('active');
    elements.tokenModalSearch?.focus();
}

function closeTokenModal() {
    elements.tokenModal?.classList.remove('active');
    if (elements.tokenModalSearch) elements.tokenModalSearch.value = '';
    renderTokens();
}

function selectToken(symbol) {
    const token = state.tokens.find(t => t.symbol === symbol);
    if (!token) return;

    if (state.selectingToken === 'from') {
        if (token.symbol === state.toToken?.symbol) {
            state.toToken = state.fromToken;
        }
        state.fromToken = token;
    } else {
        if (token.symbol === state.fromToken?.symbol) {
            state.fromToken = state.toToken;
        }
        state.toToken = token;
    }

    closeTokenModal();
    updateSwapUI();
}

function handleTokenSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = state.tokens.filter(t =>
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
    );

    elements.tokenList.innerHTML = filtered.map(token => `
        <div class="token-list-item" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" onerror="this.src='/assets/tokens/default.svg'">
            <div class="token-list-item-info">
                <div class="token-list-item-symbol">${token.symbol}</div>
                <div class="token-list-item-name">${token.name}</div>
            </div>
            <div class="token-list-item-balance">
                <div class="token-list-item-amount">${(token.balance || 0).toFixed(4)}</div>
                <div class="token-list-item-value">$${((token.balance || 0) * token.price).toFixed(2)}</div>
            </div>
        </div>
    `).join('');

    elements.tokenList.querySelectorAll('.token-list-item').forEach(item => {
        item.addEventListener('click', () => selectToken(item.dataset.symbol));
    });
}

function handleTokenGridSearch(e) {
    const query = e.target.value.toLowerCase();
    const cards = elements.tokensGrid?.querySelectorAll('.token-card');

    cards?.forEach(card => {
        const symbol = card.dataset.symbol.toLowerCase();
        const name = card.querySelector('.token-card-name')?.textContent.toLowerCase() || '';

        if (symbol.includes(query) || name.includes(query)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// ================================================
// Network Selection
// ================================================

function openNetworkModal() {
    elements.networkModal?.classList.add('active');
}

function closeNetworkModal() {
    elements.networkModal?.classList.remove('active');
}

function selectNetwork(networkId) {
    const network = NETWORKS.find(n => n.id === networkId);
    if (!network) return;

    state.network = network;

    if (elements.networkName) elements.networkName.textContent = network.name;

    elements.networkList?.querySelectorAll('.network-list-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.id) === networkId);
    });

    closeNetworkModal();
}

// ================================================
// Wallet Connection
// ================================================

function openWalletModal() {
    elements.walletModal?.classList.add('active');
}

function closeWalletModal() {
    elements.walletModal?.classList.remove('active');
}

async function connectWallet(walletId) {
    closeWalletModal();

    if (walletId === 'metamask' && typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            handleWalletConnected(accounts[0]);
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            alert('Failed to connect wallet. Please try again.');
        }
    } else {
        // Simulate connection for demo
        setTimeout(() => {
            const mockAddress = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
            handleWalletConnected(mockAddress);
        }, 1000);
    }
}

function handleWalletConnected(address) {
    state.connected = true;
    state.address = address;

    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    if (elements.connectWalletBtn) {
        elements.connectWalletBtn.innerHTML = `
            <span class="connected-dot" style="width: 8px; height: 8px; background: var(--color-success); border-radius: 50%;"></span>
            ${shortAddress}
        `;
    }

    // Set mock balances
    state.tokens.forEach(token => {
        token.balance = Math.random() * 10;
    });

    renderTokens();
    updateSwapUI();
}

// ================================================
// Settings
// ================================================

function toggleSettings() {
    elements.settingsPanel?.classList.toggle('active');
}

function handleSlippageSelect(e) {
    const value = parseFloat(e.target.dataset.value);
    state.slippage = value;

    document.querySelectorAll('.slippage-btn').forEach(btn => {
        btn.classList.toggle('active', parseFloat(btn.dataset.value) === value);
    });

    if (state.fromAmount && parseFloat(state.fromAmount) > 0) {
        calculateSwap();
    }
}

// ================================================
// Navigation
// ================================================

function handleNavClick(e) {
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    e.target.classList.add('active');
    elements.mobileMenu?.classList.remove('active');
}

function toggleMobileMenu() {
    elements.mobileMenu?.classList.toggle('active');
}

// ================================================
// Utilities
// ================================================

function closeAllModals() {
    closeTokenModal();
    closeNetworkModal();
    closeWalletModal();
    elements.mobileMenu?.classList.remove('active');
}

function formatPrice(price) {
    if (price >= 1000) {
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 1) {
        return price.toFixed(2);
    } else {
        return price.toFixed(4);
    }
}

function formatLargeNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(2);
}

function animateStats() {
    const statValues = document.querySelectorAll('.stat-value');

    statValues.forEach(stat => {
        const targetValue = parseFloat(stat.dataset.value);
        if (!targetValue) return;

        let current = 0;
        const increment = targetValue / 50;
        const isVolume = stat.closest('.stat')?.querySelector('.stat-label')?.textContent.includes('Volume');

        const timer = setInterval(() => {
            current += increment;
            if (current >= targetValue) {
                current = targetValue;
                clearInterval(timer);
            }

            if (isVolume) {
                stat.textContent = `$${current.toFixed(1)}`;
            } else if (targetValue < 100) {
                stat.textContent = Math.floor(current).toString();
            } else {
                stat.textContent = Math.floor(current).toString();
            }
        }, 30);
    });
}

// ================================================
// Ethereum Provider Events
// ================================================

if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
            state.connected = false;
            state.address = null;
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
            updateSwapUI();
        } else {
            handleWalletConnected(accounts[0]);
        }
    });

    window.ethereum.on('chainChanged', (chainId) => {
        const networkId = parseInt(chainId, 16);
        const network = NETWORKS.find(n => n.id === networkId);
        if (network) {
            selectNetwork(networkId);
        }
    });
}
