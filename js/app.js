// ================================================
// Insider Trading DEX - Main Application
// ================================================

// Token Data
const TOKENS = [
    { symbol: 'ETH', name: 'Ethereum', icon: 'assets/tokens/eth.svg', price: 2450.00, change: 3.24, balance: 0 },
    { symbol: 'USDC', name: 'USD Coin', icon: 'assets/tokens/usdc.svg', price: 1.00, change: 0.01, balance: 0 },
    { symbol: 'USDT', name: 'Tether', icon: 'assets/tokens/usdt.svg', price: 1.00, change: -0.02, balance: 0 },
    { symbol: 'BTC', name: 'Bitcoin', icon: 'assets/tokens/btc.svg', price: 43250.00, change: 2.15, balance: 0 },
    { symbol: 'BNB', name: 'BNB', icon: 'assets/tokens/bnb.svg', price: 312.50, change: -1.32, balance: 0 },
    { symbol: 'ARB', name: 'Arbitrum', icon: 'assets/tokens/arb.svg', price: 1.85, change: 5.67, balance: 0 },
    { symbol: 'OP', name: 'Optimism', icon: 'assets/tokens/op.svg', price: 3.42, change: 4.21, balance: 0 },
    { symbol: 'MATIC', name: 'Polygon', icon: 'assets/tokens/matic.svg', price: 0.92, change: -2.15, balance: 0 },
    { symbol: 'LINK', name: 'Chainlink', icon: 'assets/tokens/link.svg', price: 14.85, change: 1.89, balance: 0 },
    { symbol: 'UNI', name: 'Uniswap', icon: 'assets/tokens/uni.svg', price: 7.23, change: 2.45, balance: 0 },
    { symbol: 'AAVE', name: 'Aave', icon: 'assets/tokens/aave.svg', price: 98.50, change: 3.78, balance: 0 },
    { symbol: 'CRV', name: 'Curve', icon: 'assets/tokens/crv.svg', price: 0.58, change: -0.85, balance: 0 },
];

// Network Data
const NETWORKS = [
    { id: 1, name: 'Ethereum', icon: 'assets/networks/ethereum.svg', rpc: 'https://mainnet.infura.io' },
    { id: 42161, name: 'Arbitrum', icon: 'assets/networks/arbitrum.svg', rpc: 'https://arb1.arbitrum.io/rpc' },
    { id: 10, name: 'Optimism', icon: 'assets/networks/optimism.svg', rpc: 'https://mainnet.optimism.io' },
    { id: 137, name: 'Polygon', icon: 'assets/networks/polygon.svg', rpc: 'https://polygon-rpc.com' },
    { id: 56, name: 'BNB Chain', icon: 'assets/networks/bnb.svg', rpc: 'https://bsc-dataseed.binance.org' },
    { id: 8453, name: 'Base', icon: 'assets/networks/base.svg', rpc: 'https://mainnet.base.org' },
];

// Wallet Data
const WALLETS = [
    { id: 'metamask', name: 'MetaMask', icon: 'assets/wallets/metamask.svg', tag: 'Popular' },
    { id: 'walletconnect', name: 'WalletConnect', icon: 'assets/wallets/walletconnect.svg', tag: '' },
    { id: 'coinbase', name: 'Coinbase Wallet', icon: 'assets/wallets/coinbase.svg', tag: '' },
    { id: 'trust', name: 'Trust Wallet', icon: 'assets/wallets/trust.svg', tag: '' },
    { id: 'rainbow', name: 'Rainbow', icon: 'assets/wallets/rainbow.svg', tag: '' },
];

// Pool Data
const POOLS = [
    { token0: 'ETH', token1: 'USDC', fee: '0.3%', tvl: '$542.8M', volume: '$128.4M', apr: '24.5%' },
    { token0: 'ETH', token1: 'USDT', fee: '0.3%', tvl: '$312.5M', volume: '$89.2M', apr: '18.2%' },
    { token0: 'BTC', token1: 'ETH', fee: '0.3%', tvl: '$256.1M', volume: '$67.8M', apr: '15.8%' },
    { token0: 'ETH', token1: 'ARB', fee: '0.3%', tvl: '$124.7M', volume: '$45.3M', apr: '32.4%' },
    { token0: 'USDC', token1: 'USDT', fee: '0.05%', tvl: '$98.4M', volume: '$234.5M', apr: '8.2%' },
];

// Application State
const state = {
    connected: false,
    address: null,
    network: NETWORKS[0],
    fromToken: TOKENS[0],
    toToken: TOKENS[1],
    fromAmount: '',
    toAmount: '',
    slippage: 0.5,
    deadline: 20,
    selectingToken: null, // 'from' or 'to'
};

// DOM Elements
const elements = {
    // Buttons
    connectWalletBtn: document.getElementById('connectWalletBtn'),
    networkBtn: document.getElementById('networkBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    swapDirectionBtn: document.getElementById('swapDirectionBtn'),
    swapBtn: document.getElementById('swapBtn'),
    fromTokenBtn: document.getElementById('fromTokenBtn'),
    toTokenBtn: document.getElementById('toTokenBtn'),
    ctaConnectBtn: document.getElementById('ctaConnectBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),

    // Inputs
    fromAmount: document.getElementById('fromAmount'),
    toAmount: document.getElementById('toAmount'),
    tokenSearch: document.getElementById('tokenSearch'),
    tokenModalSearch: document.getElementById('tokenModalSearch'),

    // Displays
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

    // Panels & Modals
    settingsPanel: document.getElementById('settingsPanel'),
    tokenModal: document.getElementById('tokenModal'),
    networkModal: document.getElementById('networkModal'),
    walletModal: document.getElementById('walletModal'),
    mobileMenu: document.getElementById('mobileMenu'),

    // Lists
    tokenList: document.getElementById('tokenList'),
    commonTokensList: document.getElementById('commonTokensList'),
    networkList: document.getElementById('networkList'),
    walletList: document.getElementById('walletList'),
    poolsTableBody: document.getElementById('poolsTableBody'),
    tokensGrid: document.getElementById('tokensGrid'),

    // Close Buttons
    closeTokenModal: document.getElementById('closeTokenModal'),
    closeNetworkModal: document.getElementById('closeNetworkModal'),
    closeWalletModal: document.getElementById('closeWalletModal'),
};

// ================================================
// Initialization
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    renderTokens();
    renderPools();
    renderTokenCards();
    renderNetworks();
    renderWallets();
    renderCommonTokens();
    updateSwapUI();
    setupEventListeners();
    animateStats();
}

// ================================================
// Event Listeners
// ================================================

function setupEventListeners() {
    // Wallet Connection
    elements.connectWalletBtn?.addEventListener('click', openWalletModal);
    elements.ctaConnectBtn?.addEventListener('click', openWalletModal);

    // Network Selection
    elements.networkBtn?.addEventListener('click', openNetworkModal);

    // Settings Toggle
    elements.settingsBtn?.addEventListener('click', toggleSettings);

    // Swap Direction
    elements.swapDirectionBtn?.addEventListener('click', swapTokens);

    // Token Selection
    elements.fromTokenBtn?.addEventListener('click', () => openTokenModal('from'));
    elements.toTokenBtn?.addEventListener('click', () => openTokenModal('to'));

    // Amount Inputs
    elements.fromAmount?.addEventListener('input', handleFromAmountChange);

    // Token Search
    elements.tokenModalSearch?.addEventListener('input', handleTokenSearch);
    elements.tokenSearch?.addEventListener('input', handleTokenGridSearch);

    // Modal Close Buttons
    elements.closeTokenModal?.addEventListener('click', closeTokenModal);
    elements.closeNetworkModal?.addEventListener('click', closeNetworkModal);
    elements.closeWalletModal?.addEventListener('click', closeWalletModal);

    // Modal Overlay Clicks
    elements.tokenModal?.addEventListener('click', (e) => {
        if (e.target === elements.tokenModal) closeTokenModal();
    });
    elements.networkModal?.addEventListener('click', (e) => {
        if (e.target === elements.networkModal) closeNetworkModal();
    });
    elements.walletModal?.addEventListener('click', (e) => {
        if (e.target === elements.walletModal) closeWalletModal();
    });

    // Swap Button
    elements.swapBtn?.addEventListener('click', handleSwap);

    // Mobile Menu
    elements.mobileMenuBtn?.addEventListener('click', toggleMobileMenu);

    // Quick Amount Buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickAmount);
    });

    // Slippage Buttons
    document.querySelectorAll('.slippage-btn').forEach(btn => {
        btn.addEventListener('click', handleSlippageSelect);
    });

    // Navigation Links
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.addEventListener('click', handleNavClick);
    });

    // Keyboard Events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ================================================
// Rendering Functions
// ================================================

function renderTokens() {
    if (!elements.tokenList) return;

    elements.tokenList.innerHTML = TOKENS.map(token => `
        <div class="token-list-item" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" onerror="this.src='assets/tokens/default.svg'">
            <div class="token-list-item-info">
                <div class="token-list-item-symbol">${token.symbol}</div>
                <div class="token-list-item-name">${token.name}</div>
            </div>
            <div class="token-list-item-balance">
                <div class="token-list-item-amount">${token.balance.toFixed(4)}</div>
                <div class="token-list-item-value">$${(token.balance * token.price).toFixed(2)}</div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    elements.tokenList.querySelectorAll('.token-list-item').forEach(item => {
        item.addEventListener('click', () => selectToken(item.dataset.symbol));
    });
}

function renderCommonTokens() {
    if (!elements.commonTokensList) return;

    const commonSymbols = ['ETH', 'USDC', 'USDT', 'BTC'];
    const commonTokens = TOKENS.filter(t => commonSymbols.includes(t.symbol));

    elements.commonTokensList.innerHTML = commonTokens.map(token => `
        <button class="common-token-btn" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" onerror="this.src='assets/tokens/default.svg'">
            ${token.symbol}
        </button>
    `).join('');

    elements.commonTokensList.querySelectorAll('.common-token-btn').forEach(btn => {
        btn.addEventListener('click', () => selectToken(btn.dataset.symbol));
    });
}

function renderPools() {
    if (!elements.poolsTableBody) return;

    elements.poolsTableBody.innerHTML = POOLS.map(pool => {
        const token0 = TOKENS.find(t => t.symbol === pool.token0);
        const token1 = TOKENS.find(t => t.symbol === pool.token1);

        return `
            <tr>
                <td>
                    <div class="pool-pair">
                        <div class="pool-icons">
                            <img src="${token0?.icon || 'assets/tokens/default.svg'}" alt="${pool.token0}">
                            <img src="${token1?.icon || 'assets/tokens/default.svg'}" alt="${pool.token1}">
                        </div>
                        <div>
                            <div class="pool-names">${pool.token0}/${pool.token1}</div>
                            <div class="pool-fee-badge">${pool.fee}</div>
                        </div>
                    </div>
                </td>
                <td class="pool-tvl">${pool.tvl}</td>
                <td class="pool-volume">${pool.volume}</td>
                <td class="pool-apr">${pool.apr}</td>
                <td>
                    <button class="pool-action-btn">Add Liquidity</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderTokenCards() {
    if (!elements.tokensGrid) return;

    elements.tokensGrid.innerHTML = TOKENS.map(token => `
        <div class="token-card" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" class="token-card-icon" onerror="this.src='assets/tokens/default.svg'">
            <div class="token-card-info">
                <div class="token-card-name">${token.name}</div>
                <div class="token-card-symbol">${token.symbol}</div>
            </div>
            <div class="token-card-price">
                <div class="token-card-price-value">$${formatPrice(token.price)}</div>
                <div class="token-card-change ${token.change >= 0 ? 'positive' : 'negative'}">
                    ${token.change >= 0 ? '+' : ''}${token.change.toFixed(2)}%
                </div>
            </div>
        </div>
    `).join('');

    elements.tokensGrid.querySelectorAll('.token-card').forEach(card => {
        card.addEventListener('click', () => {
            const symbol = card.dataset.symbol;
            state.fromToken = TOKENS.find(t => t.symbol === symbol) || TOKENS[0];
            state.toToken = TOKENS.find(t => t.symbol === 'USDC') || TOKENS[1];
            updateSwapUI();
            document.getElementById('swap')?.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function renderNetworks() {
    if (!elements.networkList) return;

    elements.networkList.innerHTML = NETWORKS.map(network => `
        <div class="network-list-item ${network.id === state.network.id ? 'active' : ''}" data-id="${network.id}">
            <img src="${network.icon}" alt="${network.name}" onerror="this.src='assets/networks/default.svg'">
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
            <img src="${wallet.icon}" alt="${wallet.name}" onerror="this.src='assets/wallets/default.svg'">
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
    // Update token displays
    if (elements.fromTokenIcon) elements.fromTokenIcon.src = state.fromToken.icon;
    if (elements.fromTokenSymbol) elements.fromTokenSymbol.textContent = state.fromToken.symbol;
    if (elements.toTokenIcon) elements.toTokenIcon.src = state.toToken.icon;
    if (elements.toTokenSymbol) elements.toTokenSymbol.textContent = state.toToken.symbol;

    // Update balances
    if (elements.fromBalance) elements.fromBalance.textContent = state.fromToken.balance.toFixed(4);
    if (elements.toBalance) elements.toBalance.textContent = state.toToken.balance.toFixed(4);

    // Calculate swap
    calculateSwap();

    // Update swap button
    updateSwapButton();

    // Update route display
    updateRouteDisplay();
}

function calculateSwap() {
    const fromAmount = parseFloat(state.fromAmount) || 0;
    const rate = state.fromToken.price / state.toToken.price;
    const toAmount = fromAmount * rate;

    state.toAmount = toAmount > 0 ? toAmount.toFixed(6) : '';

    // Update displays
    if (elements.toAmount) elements.toAmount.value = state.toAmount;
    if (elements.fromUsdValue) elements.fromUsdValue.textContent = (fromAmount * state.fromToken.price).toFixed(2);
    if (elements.toUsdValue) elements.toUsdValue.textContent = (toAmount * state.toToken.price).toFixed(2);

    // Update swap details
    if (elements.swapRate) {
        elements.swapRate.textContent = `1 ${state.fromToken.symbol} = ${rate.toFixed(4)} ${state.toToken.symbol}`;
    }
    if (elements.minReceived) {
        const minAmount = toAmount * (1 - state.slippage / 100);
        elements.minReceived.textContent = `${minAmount.toFixed(4)} ${state.toToken.symbol}`;
    }
    if (elements.priceImpact) {
        const impact = fromAmount > 1000 ? (fromAmount / 10000).toFixed(2) : '<0.01';
        elements.priceImpact.textContent = typeof impact === 'string' ? impact + '%' : impact + '%';
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

    // Swap amounts
    const tempAmount = state.fromAmount;
    state.fromAmount = state.toAmount;
    elements.fromAmount.value = state.fromAmount;

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
    } else if (parseFloat(state.fromAmount) > state.fromToken.balance) {
        btnText.textContent = `Insufficient ${state.fromToken.symbol} balance`;
        elements.swapBtn.disabled = true;
    } else {
        btnText.textContent = 'Swap';
        elements.swapBtn.disabled = false;
    }
}

function updateRouteDisplay() {
    const routePath = document.getElementById('routePath');
    if (!routePath) return;

    routePath.innerHTML = `
        <div class="route-token">
            <img src="${state.fromToken.icon}" alt="${state.fromToken.symbol}" onerror="this.src='assets/tokens/default.svg'">
            <span>${state.fromToken.symbol}</span>
        </div>
        <svg class="route-arrow" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="route-pool">
            <span class="pool-name">Insider V2</span>
            <span class="pool-fee">0.3%</span>
        </div>
        <svg class="route-arrow" viewBox="0 0 24 24" fill="none">
            <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="route-token">
            <img src="${state.toToken.icon}" alt="${state.toToken.symbol}" onerror="this.src='assets/tokens/default.svg'">
            <span>${state.toToken.symbol}</span>
        </div>
    `;
}

function handleSwap() {
    if (!state.connected) {
        openWalletModal();
        return;
    }

    // Simulate swap - in production, this would call smart contracts
    const btnText = elements.swapBtn.querySelector('.swap-btn-text') || elements.swapBtn;
    btnText.textContent = 'Swapping...';
    elements.swapBtn.disabled = true;

    setTimeout(() => {
        alert(`Swap successful!\n\nSwapped ${state.fromAmount} ${state.fromToken.symbol} for ${state.toAmount} ${state.toToken.symbol}`);
        state.fromAmount = '';
        state.toAmount = '';
        elements.fromAmount.value = '';
        elements.toAmount.value = '';
        updateSwapUI();
    }, 2000);
}

function handleQuickAmount(e) {
    if (!state.connected) return;

    const percent = parseInt(e.target.dataset.percent);
    const amount = (state.fromToken.balance * percent / 100).toFixed(6);
    state.fromAmount = amount;
    elements.fromAmount.value = amount;
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
    const token = TOKENS.find(t => t.symbol === symbol);
    if (!token) return;

    if (state.selectingToken === 'from') {
        if (token.symbol === state.toToken.symbol) {
            state.toToken = state.fromToken;
        }
        state.fromToken = token;
    } else {
        if (token.symbol === state.fromToken.symbol) {
            state.fromToken = state.toToken;
        }
        state.toToken = token;
    }

    closeTokenModal();
    updateSwapUI();
}

function handleTokenSearch(e) {
    const query = e.target.value.toLowerCase();
    const filtered = TOKENS.filter(t =>
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
    );

    elements.tokenList.innerHTML = filtered.map(token => `
        <div class="token-list-item" data-symbol="${token.symbol}">
            <img src="${token.icon}" alt="${token.symbol}" onerror="this.src='assets/tokens/default.svg'">
            <div class="token-list-item-info">
                <div class="token-list-item-symbol">${token.symbol}</div>
                <div class="token-list-item-name">${token.name}</div>
            </div>
            <div class="token-list-item-balance">
                <div class="token-list-item-amount">${token.balance.toFixed(4)}</div>
                <div class="token-list-item-value">$${(token.balance * token.price).toFixed(2)}</div>
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

    // Update UI
    if (elements.networkName) elements.networkName.textContent = network.name;

    // Update network list selection
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

    // Check if MetaMask is available
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

    // Update UI
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

    if (elements.connectWalletBtn) {
        elements.connectWalletBtn.innerHTML = `
            <span class="connected-dot" style="width: 8px; height: 8px; background: var(--color-success); border-radius: 50%;"></span>
            ${shortAddress}
        `;
    }

    // Set mock balances
    TOKENS.forEach(token => {
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

    calculateSwap();
}

// ================================================
// Navigation
// ================================================

function handleNavClick(e) {
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    e.target.classList.add('active');

    // Close mobile menu
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
            // Disconnected
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
